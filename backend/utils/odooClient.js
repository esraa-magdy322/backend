const axios = require('axios');

// ─── Odoo 19 JSON-RPC Client ────────────────────────────────────────────────

const DEFAULT_ODOO_URL = 'https://esraa-magdy322-project3-2-stage-35140967.dev.odoo.com';

function normalizeOdooUrl(rawValue) {
  const trimmed = (rawValue || '').trim();
  if (!trimmed) return DEFAULT_ODOO_URL;

  const cleaned = trimmed.replace(/^API_BASE_URL/i, '').replace(/\/$/, '');
  if (/^https?:\/\//i.test(cleaned)) return cleaned;

  console.warn(`[Odoo] Invalid ODOO_URL value "${trimmed}". Falling back to ${DEFAULT_ODOO_URL}`);
  return DEFAULT_ODOO_URL;
}

const ODOO_URL      = normalizeOdooUrl(process.env.ODOO_URL);
const ODOO_DB       = process.env.ODOO_DB       || '';
const ODOO_USERNAME = process.env.ODOO_USERNAME || '';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || '';

/**
 * تجربة عدة مسارات للـ JSON-RPC حتى نلاقي الصح
 * Odoo SaaS (dev.odoo.com) بيستخدم /jsonrpc
 * Odoo Community/Enterprise بيستخدم /web/jsonrpc
 */
async function callOdooJsonRpc(payload) {
  const endpoints = [
    `${ODOO_URL}/jsonrpc`,
    `${ODOO_URL}/web/jsonrpc`,
  ];

  let lastError;
  for (const url of endpoints) {
    try {
      console.log(`[Odoo] Trying: ${url}`);
      const resp = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      console.log(`[Odoo] Success: ${url}`);
      return resp.data;
    } catch (err) {
      console.warn(`[Odoo] Failed ${url}: ${err.response?.status || err.message}`);
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * تسجيل الدخول والحصول على uid
 */
async function getOdooUid() {
  if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_PASSWORD) {
    throw new Error(
      'Odoo credentials missing. Check ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD in .env'
    );
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      service: 'common',
      method: 'login',
      args: [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD],
    },
  };

  const data = await callOdooJsonRpc(payload);

  if (data?.error) {
    throw new Error(`Odoo error: ${data.error.data?.message || JSON.stringify(data.error)}`);
  }

  const uid = data?.result;
  if (!uid) {
    throw new Error('Odoo login failed – wrong username or password or database name.');
  }

  return uid;
}

/**
 * جلب جميع الشركات من Odoo 19
 */
async function fetchCompaniesFromOdoo() {
  const uid = await getOdooUid();

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      service: 'object',
      method: 'execute_kw',
      args: [
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        'res.partner',
        'search_read',
        [[['is_company', '=', true]]],
        {
          fields: [
            'id', 'name', 'email', 'phone',
            'city', 'country_id', 'website', 'vat',
            'company_type', 'active', 'create_date', 'write_date',
          ],
          limit: 500,
          order: 'create_date desc',
        },
      ],
    },
  };

  const data = await callOdooJsonRpc(payload);

  if (data?.error) {
    throw new Error(`Odoo error: ${data.error.data?.message || JSON.stringify(data.error)}`);
  }

  const result = data?.result;
  if (!Array.isArray(result)) {
    throw new Error('Unexpected response from Odoo.');
  }

  return result.map((p) => ({
    odooId:      p.id,
    name:        p.name              || '',
    email:       p.email             || '',
    phone:       p.phone             || '',
    city:        p.city              || '',
    country:     p.country_id?.[1]   || '',
    website:     p.website           || '',
    vat:         p.vat               || '',
    companyType: p.company_type      || 'company',
    active:      p.active            ?? true,
    createdAt:   p.create_date       || null,
    updatedAt:   p.write_date        || null,
  }));
}

module.exports = { fetchCompaniesFromOdoo, getOdooUid };
