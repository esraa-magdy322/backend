const asyncHandler = require('express-async-handler');
const Company = require('../Model/companyModel');
const axios = require('axios');

const ODOO_URL = (process.env.ODOO_URL || 'https://esraa-magdy322-project3-2-stage-35140967.dev.odoo.com').replace(/\/$/, '');

// ── Helper to call Odoo JSON-RPC API ───────────────────────────────────────
async function callOdooApi(path, params) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: params || {}
  };
  
  // Try /jsonrpc and /web/jsonrpc URL structures
  const urls = [`${ODOO_URL}${path}`, `${ODOO_URL}/web${path}`];
  let lastErr;
  
  for (const url of urls) {
    try {
      console.log(`[Odoo Payroll API] POST ${url}`);
      const resp = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });
      if (resp.data && resp.data.result) {
        return resp.data.result;
      }
      if (resp.data && resp.data.error) {
        throw new Error(resp.data.error.data?.message || JSON.stringify(resp.data.error));
      }
    } catch (err) {
      console.warn(`[Odoo Payroll API] Failed ${url}: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to connect to Odoo API');
}

// ── GET /api/payroll/payslips?companyId=xxx&month=2026-06&employeeId=xx ───
const getPayslips = asyncHandler(async (req, res) => {
  const { month, employeeId } = req.query;

  // Query Odoo for payslips
  const odooParams = {};
  if (employeeId) {
    odooParams.employeeId = employeeId;
  }
  if (month) {
    odooParams.month = month;
  }

  try {
    const odooResult = await callOdooApi('/api/payroll/payslips', odooParams);
    if (odooResult && odooResult.status === 'success') {
      const payslips = odooResult.data || [];
      
      // Calculate stats (needed for the dashboard)
      const totalNet       = payslips.reduce((s, p) => s + p.netPay,      0);
      const totalSalaries  = payslips.reduce((s, p) => s + p.baseSalary,  0);
      const totalBonuses   = payslips.reduce((s, p) => s + p.bonus,       0);
      const totalDeductions= payslips.reduce((s, p) => s + p.deductions,  0);
      const paidCount      = payslips.filter(p => p.status === 'Paid').length;
      const processingCount= payslips.filter(p => p.status === 'Processing').length;
      const avgSalary      = payslips.length > 0
        ? Math.round(totalSalaries / payslips.length) : 0;
        
      // Map Odoo ID to Mongo-like _id for frontend compatibility
      const formattedData = payslips.map(p => ({
        ...p,
        _id: String(p.id)
      }));

      res.status(200).json({
        status: 'success',
        month,
        stats: { totalNet, totalSalaries, totalBonuses, totalDeductions, paidCount, processingCount, avgSalary },
        data: formattedData,
      });
    } else {
      res.status(400).json({ status: 'error', message: odooResult?.message || 'Failed to fetch from Odoo' });
    }
  } catch (err) {
    console.error('[Odoo getPayslips Error]:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── POST /api/payroll/payslips  (Create one payslip) ──────────────────────
const createPayslip = asyncHandler(async (req, res) => {
  const {
    employeeId,
    baseSalary,
    bonus = 0,
    deductions = 0,
    status = 'Processing',
    month,
    notes,
  } = req.body;

  if (!employeeId || !baseSalary) {
    res.status(400);
    throw new Error('employeeId and baseSalary are required');
  }

  const odooParams = {
    employeeId,
    baseSalary: Number(baseSalary),
    bonus: Number(bonus),
    deductions: Number(deductions),
    status,
    month,
    notes
  };

  try {
    const odooResult = await callOdooApi('/api/payroll/payslips/create', odooParams);
    if (odooResult && odooResult.status === 'success') {
      const payslip = odooResult.data;
      res.status(201).json({
        status: 'success',
        data: {
          ...payslip,
          _id: String(payslip.id)
        }
      });
    } else {
      res.status(400).json({ status: 'error', message: odooResult?.message || 'Failed to create in Odoo' });
    }
  } catch (err) {
    console.error('[Odoo createPayslip Error]:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── PUT /api/payroll/payslips/:id  (Update status/values) ─────────────────
const updatePayslip = asyncHandler(async (req, res) => {
  const payslipId = req.params.id;
  const { status, bonus, deductions, notes } = req.body;

  const odooParams = {
    id: payslipId,
    status,
    bonus: bonus !== undefined ? Number(bonus) : undefined,
    deductions: deductions !== undefined ? Number(deductions) : undefined,
    notes
  };

  try {
    const odooResult = await callOdooApi('/api/payroll/payslips/update', odooParams);
    if (odooResult && odooResult.status === 'success') {
      const payslip = odooResult.data;
      res.status(200).json({
        status: 'success',
        data: {
          ...payslip,
          _id: String(payslip.id)
        }
      });
    } else {
      res.status(400).json({ status: 'error', message: odooResult?.message || 'Failed to update in Odoo' });
    }
  } catch (err) {
    console.error('[Odoo updatePayslip Error]:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── DELETE /api/payroll/payslips/:id ─────────────────────────────────────
const deletePayslip = asyncHandler(async (req, res) => {
  const payslipId = req.params.id;

  try {
    const odooResult = await callOdooApi('/api/payroll/payslips/delete', { id: payslipId });
    if (odooResult && odooResult.status === 'success') {
      res.status(200).json({ status: 'success', message: 'Deleted' });
    } else {
      res.status(400).json({ status: 'error', message: odooResult?.message || 'Failed to delete in Odoo' });
    }
  } catch (err) {
    console.error('[Odoo deletePayslip Error]:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET /api/payroll/payslips/trend ──────────────────────────────────────
const getPayrollTrend = asyncHandler(async (req, res) => {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  try {
    // Fetch all payslips from Odoo (no month filter)
    const odooResult = await callOdooApi('/api/payroll/payslips', {});
    if (odooResult && odooResult.status === 'success') {
      const payslips = odooResult.data || [];
      
      const results = months.map(m => {
        const monthPayslips = payslips.filter(p => p.month === m);
        const amount = monthPayslips.reduce((s, p) => s + p.netPay, 0);
        const label = new Date(m + '-01').toLocaleString('en-US', { month: 'short' });
        return { month: label, amount };
      });
      
      res.status(200).json({ status: 'success', data: results });
    } else {
      res.status(400).json({ status: 'error', message: odooResult?.message || 'Failed to fetch trend from Odoo' });
    }
  } catch (err) {
    console.error('[Odoo getPayrollTrend Error]:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = { createPayslip, getPayslips, getPayrollTrend, updatePayslip, deletePayslip };
