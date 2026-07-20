const express = require('express');
const router = express.Router();
const { fetchCompaniesFromOdoo } = require('../backend/utils/odooClient');
const axios = require('axios');

const DEFAULT_ODOO_URL = 'https://esraa-magdy322-project3-2-stage-35140967.dev.odoo.com';

function normalizeOdooUrl(rawValue) {
  const trimmed = (rawValue || '').trim();
  if (!trimmed) return DEFAULT_ODOO_URL;

  const cleaned = trimmed.replace(/^API_BASE_URL/i, '').replace(/\/$/, '');
  if (/^https?:\/\//i.test(cleaned)) return cleaned;

  console.warn(`[Odoo] Invalid ODOO_URL value "${trimmed}". Falling back to ${DEFAULT_ODOO_URL}`);
  return DEFAULT_ODOO_URL;
}

const ODOO_BASE_URL = normalizeOdooUrl(process.env.ODOO_URL);

// ─── POST /odoo/addUser (and /odoo/api/addUser for compatibility) ─────────────
// Proxy to Odoo /api/addUser HTTP controller (handles company create/lookup)
router.post(['/addUser', '/api/addUser'], async (req, res) => {
  try {
    console.log('[Odoo Proxy] /odoo/addUser → forwarding to Odoo /api/addUser');
    const response = await axios.post(
      `${ODOO_BASE_URL}/api/addUser`,
      req.body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('[Odoo Proxy] /odoo/addUser error:', err.response?.status, err.message);
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(502).json({ error: { message: err.message } });
    }
  }
});


// ─── GET /odoo/companies ───────────────────────────────────────────────────
// تُعيد جميع الشركات المسجَّلة في Odoo 19
router.get('/companies', async (req, res) => {
  try {
    console.log('[Odoo Proxy] GET /odoo/companies → fetching from Odoo /api/companies');
    const response = await axios.post(
      `${ODOO_BASE_URL}/api/companies`,
      {
        jsonrpc: '2.0',
        method: 'call',
        params: {}
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    );

    const result = response.data?.result;
    if (!result || result.status === 'error') {
      throw new Error(result?.message || 'Failed to fetch companies from Odoo controller');
    }
    const companies = result.data || [];

    // دعم بحث بسيط بالاسم من query param  ?search=...
    const { search } = req.query;
    const filtered = search
      ? companies.filter((c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
        )
      : companies;

    res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (error) {
    console.error('[Odoo] fetchCompanies error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch companies from Odoo',
    });
  }
});

// ─── GET /odoo/companies/:id ───────────────────────────────────────────────
// تُعيد شركة واحدة حسب الـ Odoo ID
router.get('/companies/:id', async (req, res) => {
  try {
    console.log(`[Odoo Proxy] GET /odoo/companies/${req.params.id} → fetching from Odoo /api/companies`);
    const response = await axios.post(
      `${ODOO_BASE_URL}/api/companies`,
      {
        jsonrpc: '2.0',
        method: 'call',
        params: {}
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    );

    const result = response.data?.result;
    if (!result || result.status === 'error') {
      throw new Error(result?.message || 'Failed to fetch companies from Odoo controller');
    }
    const companies = result.data || [];
    const company = companies.find((c) => c.odooId === Number(req.params.id));

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found in Odoo' });
    }

    res.status(200).json({ success: true, data: company });
  } catch (error) {
    console.error('[Odoo] getCompanyById error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper for JSON-RPC
const callOdoo = async (url, payload) => {
  const resp = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });
  return resp.data;
};

const getManagerEmployee = async (odooUrl, uid, password, email) => {
  const empPayload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      service: 'object',
      method: 'execute_kw',
      args: [
        process.env.ODOO_DB || '',
        uid,
        password,
        'hr.employee',
        'search_read',
        [[['work_email', '=', email]]],
        { fields: ['id', 'name', 'company_id'] }
      ]
    }
  };
  const empRes = await callOdoo(odooUrl, empPayload);
  let employee = empRes.result?.[0];

  if (!employee && email === (process.env.ODOO_USERNAME || 'admin@gmail.com')) {
    const companiesPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now() + 1,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          process.env.ODOO_DB || '',
          uid,
          password,
          'res.company',
          'search_read',
          [[]],
          { fields: ['id', 'name'] }
        ]
      }
    };
    try {
      const companiesRes = await callOdoo(odooUrl, companiesPayload);
      const firstCompany = companiesRes.result?.[0];
      if (firstCompany) {
        employee = {
          id: 1,
          name: 'System Administrator',
          company_id: [firstCompany.id, firstCompany.name]
        };
      }
    } catch (err) {
      console.error('[Odoo admin company fallback error]:', err.message);
    }
  }

  return employee;
};

// ─── POST /odoo/appraisals/list ───────────────────────────────────────────
// Fetches appraisals where the logged-in user (email) is one of the manager_ids.
router.post('/appraisals/list', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }
  try {
    const odooUrl = ODOO_BASE_URL.replace(/\/$/, '') + '/jsonrpc';
    
    // Login to JSON-RPC
    const loginPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {
        service: 'common',
        method: 'login',
        args: [process.env.ODOO_DB || '', email, password],
      },
    };
    
    const loginRes = await callOdoo(odooUrl, loginPayload);
    const uid = loginRes.result;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Invalid Odoo credentials' });
    }

    // 1. Get manager's employee record
    const employee = await getManagerEmployee(odooUrl, uid, password, email);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Manager employee record not found in Odoo' });
    }

    // 2. Fetch appraisals where manager_ids contains our employee ID
    const appraisalPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now() + 2,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          process.env.ODOO_DB || '',
          uid,
          password,
          'hr.appraisal',
          'search_read',
          [[['manager_ids', 'in', [employee.id]]]],
          {
            fields: [
              'id',
              'employee_id',
              'manager_ids',
              'state',
              'accessible_manager_feedback',
              'note',
              'date_close',
              'create_date'
            ],
            order: 'create_date desc'
          }
        ]
      }
    };
    const appRes = await callOdoo(odooUrl, appraisalPayload);
    
    res.status(200).json({
      success: true,
      data: appRes.result || [],
      managerEmployeeId: employee.id,
      companyId: employee.company_id?.[0]
    });
  } catch (err) {
    console.error('Odoo /appraisals/list error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /odoo/appraisals/employees ──────────────────────────────────────
// Returns all employees in the manager's company to choose for appraisal.
router.post('/appraisals/employees', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }
  try {
    const odooUrl = ODOO_BASE_URL.replace(/\/$/, '') + '/jsonrpc';
    
    const loginPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {
        service: 'common',
        method: 'login',
        args: [process.env.ODOO_DB || '', email, password],
      },
    };
    
    const loginRes = await callOdoo(odooUrl, loginPayload);
    const uid = loginRes.result;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Invalid Odoo credentials' });
    }

    // Get manager's company ID
    const employee = await getManagerEmployee(odooUrl, uid, password, email);
    if (!employee || !employee.company_id) {
      return res.status(404).json({ success: false, message: 'Manager company not found in Odoo' });
    }

    // Get all employees in the same company
    const allPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now() + 2,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          process.env.ODOO_DB || '',
          uid,
          password,
          'hr.employee',
          'search_read',
          [[['company_id', '=', employee.company_id[0]], ['id', '!=', employee.id]]],
          { fields: ['id', 'name', 'work_email', 'job_title', 'department'] }
        ]
      }
    };
    const allRes = await callOdoo(odooUrl, allPayload);
    res.status(200).json({ success: true, data: allRes.result || [] });
  } catch (err) {
    console.error('Odoo /appraisals/employees error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /odoo/attendance/company-today ──────────────────────────────────
// Returns actual today's attendance logs for all employees in the manager's company.
router.post('/attendance/company-today', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }
  try {
    const odooUrl = ODOO_BASE_URL.replace(/\/$/, '') + '/jsonrpc';
    
    // Login to JSON-RPC
    const loginPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {
        service: 'common',
        method: 'login',
        args: [process.env.ODOO_DB || '', email, password],
      },
    };
    
    const loginRes = await callOdoo(odooUrl, loginPayload);
    const uid = loginRes.result;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Invalid Odoo credentials' });
    }

    // Get manager's company ID
    const employee = await getManagerEmployee(odooUrl, uid, password, email);
    if (!employee || !employee.company_id) {
      return res.status(404).json({ success: false, message: 'Manager company not found in Odoo' });
    }

    const companyId = employee.company_id[0];

    // Fetch all employees in the same company
    const allPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now() + 2,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          process.env.ODOO_DB || '',
          uid,
          password,
          'hr.employee',
          'search_read',
          [[['company_id', '=', companyId]]],
          { fields: ['id', 'name', 'work_email', 'job_title', 'department'] }
        ]
      }
    };
    const allRes = await callOdoo(odooUrl, allPayload);
    const employeesList = allRes.result || [];
    const employeeIds = employeesList.map(e => e.id);

    if (employeeIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Calculate start of today in UTC
    const localToday = new Date();
    localToday.setHours(0, 0, 0, 0); // start of today local time
    const startOfTodayUtc = localToday.toISOString().replace('T', ' ').substring(0, 19);

    // Fetch hr.attendance records for these employees since today UTC
    const attendancePayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now() + 3,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          process.env.ODOO_DB || '',
          uid,
          password,
          'hr.attendance',
          'search_read',
          [[['employee_id', 'in', employeeIds], ['check_in', '>=', startOfTodayUtc]]],
          {
            fields: ['employee_id', 'check_in', 'check_out', 'worked_hours'],
            order: 'check_in desc'
          }
        ]
      }
    };
    const attendanceRes = await callOdoo(odooUrl, attendancePayload);
    const attendances = attendanceRes.result || [];

    // Map attendances by employee ID
    const attendanceMap = {};
    attendances.forEach(att => {
      const empId = att.employee_id[0];
      if (!attendanceMap[empId]) {
        attendanceMap[empId] = att;
      }
    });

    const parseOdooDate = (dateStr) => {
      if (!dateStr) return null;
      return new Date(dateStr.replace(' ', 'T') + 'Z');
    };

    const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Merge employees with their actual attendance
    const data = employeesList.map(emp => {
      const att = attendanceMap[emp.id];
      if (att) {
        const checkInDate = parseOdooDate(att.check_in);
        const checkOutDate = parseOdooDate(att.check_out);
        const workedHours = att.worked_hours || (checkOutDate && checkInDate ? (checkOutDate.getTime() - checkInDate.getTime()) / 3600000 : 0);
        const hoursFormatted = workedHours ? `${Math.floor(workedHours)}h ${Math.round((workedHours % 1) * 60)}m` : '-';
        
        let status = 'Present';
        if (checkOutDate) {
          if (workedHours < 7.5) {
            status = 'Left Early';
          } else if (workedHours > 8.5) {
            const extra = (workedHours - 8.0).toFixed(1);
            status = `Overtime (+${extra}h)`;
          } else if (checkInDate && (checkInDate.getHours() > 9 || (checkInDate.getHours() === 9 && checkInDate.getMinutes() > 0))) {
            status = 'Late';
          } else {
            status = 'Present';
          }
        } else {
          status = 'Checked In';
        }

        const dateStr = checkInDate ? checkInDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : todayFormatted;

        return {
          id: emp.id,
          date: dateStr,
          employee: emp.name,
          checkIn: checkInDate ? checkInDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
          checkOut: checkOutDate ? checkOutDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
          hours: hoursFormatted,
          status: status
        };
      } else {
        return {
          id: emp.id,
          date: todayFormatted,
          employee: emp.name,
          checkIn: '-',
          checkOut: '-',
          hours: '-',
          status: 'Absent'
        };
      }
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Odoo /attendance/company-today error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /odoo/appraisals/create ──────────────────────────────────────────
// Creates a new appraisal for an employee.
router.post('/appraisals/create', async (req, res) => {
  const { email, password, employeeId, companyId } = req.body;
  if (!email || !password || !employeeId) {
    return res.status(400).json({ success: false, message: 'Email, password, and employeeId are required' });
  }
  try {
    const odooUrl = ODOO_BASE_URL.replace(/\/$/, '') + '/jsonrpc';
    
    const loginPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {
        service: 'common',
        method: 'login',
        args: [process.env.ODOO_DB || '', email, password],
      },
    };
    
    const loginRes = await callOdoo(odooUrl, loginPayload);
    const uid = loginRes.result;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Invalid Odoo credentials' });
    }

    // Get manager's employee record
    const managerEmp = await getManagerEmployee(odooUrl, uid, password, email);
    if (!managerEmp) {
      return res.status(404).json({ success: false, message: 'Manager employee record not found in Odoo' });
    }

    const resolvedCompanyId = companyId || managerEmp.company_id?.[0];

    // Create appraisal
    const createPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now() + 2,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          process.env.ODOO_DB || '',
          uid,
          password,
          'hr.appraisal',
          'create',
          [{
            employee_id: Number(employeeId),
            manager_ids: [[6, 0, [managerEmp.id]]],
            company_id: resolvedCompanyId
          }]
        ]
      }
    };
    const createRes = await callOdoo(odooUrl, createPayload);
    if (createRes.error) {
      return res.status(400).json({ success: false, error: createRes.error });
    }
    
    res.status(201).json({ success: true, appraisalId: createRes.result });
  } catch (err) {
    console.error('Odoo /appraisals/create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /odoo/appraisals/update ──────────────────────────────────────────
// Updates appraisal feedback and state.
router.post('/appraisals/update', async (req, res) => {
  const { email, password, appraisalId, feedback, note, state } = req.body;
  if (!email || !password || !appraisalId) {
    return res.status(400).json({ success: false, message: 'Email, password, and appraisalId are required' });
  }
  try {
    const odooUrl = ODOO_BASE_URL.replace(/\/$/, '') + '/jsonrpc';
    
    const loginPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {
        service: 'common',
        method: 'login',
        args: [process.env.ODOO_DB || '', email, password],
      },
    };
    
    const loginRes = await callOdoo(odooUrl, loginPayload);
    const uid = loginRes.result;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Invalid Odoo credentials' });
    }

    const vals = {};
    if (feedback !== undefined) vals.accessible_manager_feedback = feedback;
    if (note !== undefined) vals.note = note;
    if (state !== undefined) vals.state = state;

    const writePayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now() + 1,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          process.env.ODOO_DB || '',
          uid,
          password,
          'hr.appraisal',
          'write',
          [[Number(appraisalId)], vals]
        ]
      }
    };
    const writeRes = await callOdoo(odooUrl, writePayload);
    if (writeRes.error) {
      return res.status(400).json({ success: false, error: writeRes.error });
    }
    
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Odoo /appraisals/update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /odoo/api/leave/admin-approve ────────────────────────────────────
// Direct admin validation bypass for auto-approval of manager leaves
router.post('/api/leave/admin-approve', async (req, res) => {
  const { email, password, leave_id } = req.body;
  if (!email || !leave_id) {
    return res.status(400).json({ success: false, message: 'Email and leave_id are required' });
  }
  try {
    // Check user role in MongoDB to make sure they are allowed to approve
    const User = require('../backend/Model/userModel');
    const user = await User.findOne({ email: email.toLowerCase() });

    const rawRole = user?.role || "";
    const normalizedRole = rawRole.toLowerCase().trim().replace(/[\s_-]+/g, '_');
    const isAutoApprove =
      normalizedRole === "hr_manager" ||
      normalizedRole === "company_admin" ||
      normalizedRole === "admin" ||
      normalizedRole === "superadmin";

    if (!isAutoApprove) {
      return res.status(403).json({ success: false, message: "You don't have the rights to approve leaves" });
    }

    const odooUrl = ODOO_BASE_URL.replace(/\/$/, '') + '/jsonrpc';
    
    // 1. Login to Odoo JSON-RPC using the system ADMIN credentials
    const loginPayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {
        service: 'common',
        method: 'login',
        args: [
          process.env.ODOO_DB || '',
          process.env.ODOO_USERNAME || 'admin@gmail.com',
          process.env.ODOO_PASSWORD || '123'
        ],
      },
    };
    
    const loginRes = await callOdoo(odooUrl, loginPayload);
    const uid = loginRes.result;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Invalid Odoo Admin credentials' });
    }

    // 2. Write state: 'validate' directly to the leave record using execute_kw with ADMIN credentials
    const writePayload = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now() + 1,
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          process.env.ODOO_DB || '',
          uid,
          process.env.ODOO_PASSWORD || '123',
          'hr.leave',
          'write',
          [[Number(leave_id)], { state: 'validate' }]
        ]
      }
    };
    const writeRes = await callOdoo(odooUrl, writePayload);
    if (writeRes.error) {
      return res.status(400).json({ success: false, error: writeRes.error });
    }
    
    res.status(200).json({ success: true, message: 'Leave request approved successfully via admin validation bypass' });
  } catch (err) {
    console.error('Odoo /api/leave/admin-approve error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /odoo/api/leave/request ──────────────────────────────────────────
// Intercept leave request to apply auto-approval for HR Manager / Admin on backend
router.post('/api/leave/request', async (req, res) => {
  const { jsonrpc, method, params } = req.body;
  if (!params || !params.email) {
    return handleProxy(req, res);
  }
  
  const { email, leave_type, leave_type_id, date_from, date_to, reason } = params;

  try {
    console.log(`[Odoo Proxy] Intercepted leave request for ${email}. Creating in Odoo...`);
    const response = await axios.post(
      `${ODOO_BASE_URL}/api/leave/request`,
      req.body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    const data = response.data;
    if (data?.result?.status === 'success' && data.result.id) {
      const leaveId = data.result.id;

      // Check user role in MongoDB
      const User = require('../backend/Model/userModel');
      const user = await User.findOne({ email: email.toLowerCase() });

      const rawRole = user?.role || "";
      const normalizedRole = rawRole.toLowerCase().trim().replace(/[\s_-]+/g, '_');
      const isAutoApprove =
        normalizedRole === "hr_manager" ||
        normalizedRole === "company_admin" ||
        normalizedRole === "admin" ||
        normalizedRole === "superadmin";

      console.log(`[Odoo Proxy] User role resolved from MongoDB: ${rawRole}. isAutoApprove: ${isAutoApprove}`);

      if (isAutoApprove) {
        console.log(`[Odoo Proxy] Auto-approving leave ID ${leaveId} via direct write using admin credentials...`);
        try {
          const odooUrl = ODOO_BASE_URL.replace(/\/$/, '') + '/jsonrpc';
          
          // Login to Odoo JSON-RPC using the system ADMIN credentials
          const loginPayload = {
            jsonrpc: '2.0',
            method: 'call',
            id: Date.now(),
            params: {
              service: 'common',
              method: 'login',
              args: [
                process.env.ODOO_DB || '',
                process.env.ODOO_USERNAME || 'admin@gmail.com',
                process.env.ODOO_PASSWORD || '123'
              ],
            },
          };
          const loginRes = await callOdoo(odooUrl, loginPayload);
          const uid = loginRes.result;
          
          if (uid) {
            // Write state: 'validate' directly to the leave record using execute_kw with ADMIN credentials
            const writePayload = {
              jsonrpc: '2.0',
              method: 'call',
              id: Date.now() + 1,
              params: {
                service: 'object',
                method: 'execute_kw',
                args: [
                  process.env.ODOO_DB || '',
                  uid,
                  process.env.ODOO_PASSWORD || '123',
                  'hr.leave',
                  'write',
                  [[Number(leaveId)], { state: 'validate' }]
                ]
              }
            };
            const writeRes = await callOdoo(odooUrl, writePayload);
            if (!writeRes.error) {
              console.log(`[Odoo Proxy] Leave ID ${leaveId} auto-approved successfully on Odoo using admin credentials.`);
              data.result.auto_approved = true;
              data.result.message = "Leave request created and auto-approved successfully";
            } else {
              console.warn('[Odoo Proxy] Direct write error:', writeRes.error);
            }
          } else {
            console.warn('[Odoo Proxy] Direct admin login failed for direct write.');
          }
        } catch (err) {
          console.error('[Odoo Proxy] Direct write auto-approve failed:', err.message);
        }
      }
    }

    res.status(response.status).json(data);
  } catch (err) {
    console.error('[Odoo Proxy] Intercepted /api/leave/request error:', err.response?.status, err.message);
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(502).json({ error: { message: err.message } });
    }
  }
});

// ─── GENERIC ODOO API PROXY ────────────────────────────────────────────────
// Proxies any GET/POST /odoo/api/* requests to ODOO_BASE_URL/api/*
const handleProxy = async (req, res) => {
  const targetUrl = `${ODOO_BASE_URL}${req.path}`;
  try {
    console.log(`[Odoo Proxy] ${req.method} /odoo${req.path} → ${targetUrl}`);
    const config = {
      method: req.method,
      url: targetUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      config.data = req.body;
    }
    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error(`[Odoo Proxy] Error on ${targetUrl}:`, err.response?.status, err.message);
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(502).json({ error: { message: err.message } });
    }
  }
};

router.post('/api/*splat', handleProxy);
router.get('/api/*splat', handleProxy);

module.exports = router;
