import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  isCloudSqlAvailable,
  seedCloudSqlIfEmpty,
  getCloudSqlPortalData,
  upsertMemberInCloudSql,
  deleteMemberInCloudSql,
  upsertEventInCloudSql,
  deleteEventInCloudSql,
  upsertGalleryInCloudSql,
  deleteGalleryInCloudSql,
  addRegistrationInCloudSql,
  deleteRegistrationInCloudSql,
  clearRegistrationsInCloudSql,
  addInquiryInCloudSql,
  setSettingInCloudSql
} from './src/db/service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Enable large JSON and form payloads for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'mesa_db.json');
const DB_SEED_FILE = path.join(DATA_DIR, 'mesa_db.seed.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'mesa_db.backup.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use('/uploads', express.static(UPLOADS_DIR));

// Helper: Save Base64 image to disk
function saveBase64Image(dataUri, prefix = 'img') {
  if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
    return dataUri;
  }
  try {
    const matches = dataUri.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) return dataUri;
    
    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';
    const base64Data = matches[2];
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error saving base64 image:', err);
    return dataUri;
  }
}

// In-memory master database cache for instant zero-latency reads
let cachedDB = null;

// Safe loader from golden seed or backup if primary file ever has issues
function loadSeedOrBackupDB() {
  // 1. Try backup
  try {
    if (fs.existsSync(DB_BACKUP_FILE)) {
      const raw = fs.readFileSync(DB_BACKUP_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.members) && parsed.members.length >= 10) {
        return parsed;
      }
    }
  } catch (e) {}

  // 2. Try golden seed
  try {
    if (fs.existsSync(DB_SEED_FILE)) {
      const raw = fs.readFileSync(DB_SEED_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.members) && parsed.members.length >= 10) {
        return parsed;
      }
    }
  } catch (e) {}

  return null;
}

// Database helper functions: Guaranteed Non-Volatile & Self-Healing
function getDB() {
  if (cachedDB && Array.isArray(cachedDB.members) && cachedDB.members.length >= 10) {
    return cachedDB;
  }

  try {
    const tmpVercelDb = path.join('/tmp', 'mesa_db.json');
    const fileToCheck = (process.env.VERCEL && fs.existsSync(tmpVercelDb)) ? tmpVercelDb : DB_FILE;
    if (fs.existsSync(fileToCheck)) {
      const raw = fs.readFileSync(fileToCheck, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.members) && parsed.members.length >= 10) {
        cachedDB = parsed;
        return cachedDB;
      }
    }
  } catch (err) {
    console.error('[MESA Database] Error reading primary DB file:', err);
  }

  // Primary file is missing, empty, or corrupted -> self-heal from backup/seed
  const fallback = loadSeedOrBackupDB();
  if (fallback) {
    console.warn('[MESA Database] Self-healing database from verified seed/backup...');
    cachedDB = fallback;
    saveDB(cachedDB);
    return cachedDB;
  }

  cachedDB = {
    adminKey: process.env.MESA_ADMIN_KEY || 'MESA@2026',
    adminEmail: 'admin@sanjivani.edu.in',
    adminPassword: '',
    privacyMode: 'masked',
    customLogoUrl: null,
    members: [],
    events: [],
    gallery: [],
    inquiries: [],
    registrations: []
  };
  return cachedDB;
}

function saveDB(data) {
  if (!data || typeof data !== 'object') return false;

  // Anti-Wiping Safety Guard: Prevent accidental truncation of council roster
  if (cachedDB && Array.isArray(cachedDB.members) && cachedDB.members.length >= 10) {
    if (!Array.isArray(data.members) || data.members.length === 0) {
      console.warn('[MESA Database Guard] Protected against empty member array overwrite. Restoring members.');
      data.members = cachedDB.members;
    }
  }

  cachedDB = data;

  try {
    const jsonString = JSON.stringify(data, null, 2);

    // Atomic disk write: Write to temporary file first, then atomically rename
    // If running on Vercel or read-only filesystem, use /tmp or preserve in-memory
    const targetDir = process.env.VERCEL ? '/tmp' : DATA_DIR;
    const targetDbFile = process.env.VERCEL ? path.join('/tmp', 'mesa_db.json') : DB_FILE;
    const tmpFile = path.join(targetDir, `mesa_db.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`);
    fs.writeFileSync(tmpFile, jsonString, 'utf8');
    fs.renameSync(tmpFile, targetDbFile);

    if (!process.env.VERCEL) {
      try {
        fs.writeFileSync(DB_BACKUP_FILE, jsonString, 'utf8');
      } catch (e) {}
    }

    return true;
  } catch (err) {
    console.warn('[MESA Database] Filesystem write notice (in-memory cache active):', err.message);
    return true;
  }
}

// Pre-initialize cache immediately on module load
cachedDB = getDB();

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

/* =========================================================================
   PUBLIC API ENDPOINTS
   ========================================================================= */

// 1. Initial State Data (Both /api/data and /api/public/data)
app.get(['/api/data', '/api/public/data'], async (req, res) => {
  if (isCloudSqlAvailable()) {
    try {
      const sqlData = await getCloudSqlPortalData();
      return res.json({
        ok: true,
        isCloudSql: true,
        ...sqlData
      });
    } catch (err) {
      console.warn('[MESA API] Cloud SQL fetch notice, falling back to local DB cache:', err.message);
    }
  }

  const db = getDB();
  res.json({
    ok: true,
    isCloudSql: false,
    members: db.members || [],
    events: db.events || [],
    gallery: db.gallery || [],
    inquiries: db.inquiries || [],
    registrations: db.registrations || [],
    privacyMode: db.privacyMode || 'masked',
    customLogoUrl: db.customLogoUrl || null
  });
});

// University Crest / Custom Logo API
app.post('/api/logo', (req, res) => {
  const db = getDB();
  const { dataUri, base64, url } = req.body;
  const raw = dataUri || base64 || url;
  if (!raw) {
    db.customLogoUrl = null;
    saveDB(db);
    if (isCloudSqlAvailable()) {
      setSettingInCloudSql('custom_logo_url', null).catch(() => {});
    }
    return res.json({ ok: true, customLogoUrl: null, message: 'Restored default vector crest.' });
  }
  const savedUrl = saveBase64Image(raw, 'crest');
  db.customLogoUrl = savedUrl || raw;
  saveDB(db);
  if (isCloudSqlAvailable()) {
    setSettingInCloudSql('custom_logo_url', db.customLogoUrl).catch(() => {});
  }
  return res.json({ ok: true, customLogoUrl: db.customLogoUrl, message: 'Custom university crest updated and saved.' });
});

// 2. Public Contact Us Inquiry Form Submission
app.post('/api/inquiries', (req, res) => {
  const { full_name, name, email, mobile, phone, message } = req.body;
  const senderName = (full_name || name || '').trim();
  const senderEmail = (email || '').trim();
  const senderPhone = (mobile || phone || '').trim();
  const senderMsg = (message || '').trim();

  if (!senderName || !senderMsg) {
    return res.status(400).json({ ok: false, error: 'Name and message are required.' });
  }

  const db = getDB();
  const newInquiry = {
    id: 'inq-' + Date.now(),
    name: senderName,
    email: senderEmail || 'Not provided',
    phone: senderPhone || 'Not provided',
    message: senderMsg,
    date: new Date().toLocaleDateString('en-IN'),
    timestamp: new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  };

  if (!db.inquiries) db.inquiries = [];
  db.inquiries.unshift(newInquiry);
  saveDB(db);

  if (isCloudSqlAvailable()) {
    addInquiryInCloudSql(newInquiry).catch(e => console.error('[Cloud SQL] Inquiry save error:', e));
  }

  res.json({ ok: true, data: newInquiry });
});

// 3. Public Event Registration Submission
app.post('/api/registrations', (req, res) => {
  const {
    event_id, eventId, eventTitle,
    full_name, name,
    prn_number, prn,
    branch, department,
    year_of_study, year, class_year,
    email, mobile, phone,
    entry_type, entryType,
    fee,
    transaction_id, transactionId, utr,
    payment_screenshot, paymentScreenshot,
    notes
  } = req.body;
  
  const studentName = (full_name || name || '').trim();
  const studentPrn = (prn_number || prn || '').trim();
  const studentEmail = (email || '').trim();
  const studentPhone = (mobile || phone || '').trim();
  const studentBranch = (branch || department || 'Mechanical Engineering').trim();
  const studentYear = (year_of_study || year || class_year || 'Third Year (TY B.Tech)').trim();
  const idEvent = event_id || eventId || '';

  if (!studentName) {
    return res.status(400).json({ ok: false, error: 'Student full name is required.' });
  }
  if (!studentPrn) {
    return res.status(400).json({ ok: false, error: 'Student PRN number is required.' });
  }
  if (!studentPhone) {
    return res.status(400).json({ ok: false, error: 'Mobile contact number is required.' });
  }

  const db = getDB();
  const matchedEvent = (db.events || []).find(e => e.id === idEvent);
  if (!matchedEvent) {
    return res.status(404).json({ ok: false, error: 'Selected event could not be found.' });
  }

  // 1. Check if event registration is administratively CLOSED
  const eventStatus = (matchedEvent.status || 'OPEN').toUpperCase();
  if (eventStatus === 'CLOSED') {
    return res.status(400).json({ ok: false, error: 'Registration for this event is currently closed by the administration.' });
  }

  // 2. Check registration deadline
  if (matchedEvent.deadline) {
    const deadlineTime = new Date(matchedEvent.deadline).getTime();
    if (!isNaN(deadlineTime) && Date.now() > deadlineTime) {
      return res.status(400).json({ ok: false, error: 'Registration deadline for this event has passed.' });
    }
  }

  // 3. Check maximum participant limit
  const currentRegistrations = (db.registrations || []).filter(r => r.eventId === idEvent);
  const maxSeats = matchedEvent.maxParticipants ? Number(matchedEvent.maxParticipants) : null;
  if (maxSeats && currentRegistrations.length >= maxSeats) {
    return res.status(400).json({ ok: false, error: `Registration full! Maximum participant capacity of ${maxSeats} seats has been reached.` });
  }

  // 4. DUPLICATE-REGISTRATION PROTECTION: Check PRN and Mobile Number
  const normPrn = studentPrn.toUpperCase();
  const digitsPhone = studentPhone.replace(/[^0-9]/g, '');
  const last10Phone = digitsPhone.length >= 10 ? digitsPhone.slice(-10) : digitsPhone;

  const existingRegistration = currentRegistrations.find(r => {
    const existingPrn = (r.prn || '').trim().toUpperCase();
    const existingDigits = (r.phone || r.mobile || '').replace(/[^0-9]/g, '');
    const existingLast10 = existingDigits.length >= 10 ? existingDigits.slice(-10) : existingDigits;

    const prnMatches = existingPrn && existingPrn === normPrn;
    const phoneMatches = last10Phone.length >= 7 && existingLast10 && existingLast10 === last10Phone;
    return prnMatches || phoneMatches;
  });

  if (existingRegistration) {
    const isPrnDupe = existingRegistration.prn && existingRegistration.prn.trim().toUpperCase() === normPrn;
    const dupeDetail = isPrnDupe ? `PRN (${studentPrn})` : `Mobile Number (${studentPhone})`;
    return res.status(409).json({
      ok: false,
      error: `You are already registered for this event! A confirmed registration with ${dupeDetail} is already on record.`
    });
  }

  // 5. Entry type and fee handling
  const eventEntryType = (matchedEvent.entryType || entry_type || entryType || 'free').toLowerCase();
  const txnNumber = (transaction_id || transactionId || utr || '').trim();
  const rawScreenshot = payment_screenshot || paymentScreenshot || null;

  if (eventEntryType === 'paid') {
    if (!txnNumber) {
      return res.status(400).json({ ok: false, error: 'Payment Transaction ID / UTR number is required for paid entry.' });
    }
  }

  let savedScreenshotUrl = null;
  if (rawScreenshot) {
    savedScreenshotUrl = saveBase64Image(rawScreenshot, 'payment');
  }

  const title = eventTitle || matchedEvent?.title || 'MESA Event';
  const newReg = {
    id: 'reg-' + Date.now(),
    eventId: idEvent,
    eventTitle: title,
    name: studentName,
    prn: normPrn,
    branch: studentBranch,
    year: studentYear,
    email: studentEmail || 'Not provided',
    phone: studentPhone,
    entryType: eventEntryType,
    fee: eventEntryType === 'paid' ? (matchedEvent.fee || fee || 0) : 0,
    transactionId: txnNumber || null,
    paymentScreenshot: savedScreenshotUrl || null,
    notes: (notes || 'None').trim(),
    timestamp: new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  };

  if (!db.registrations) db.registrations = [];
  db.registrations.unshift(newReg);
  saveDB(db);

  if (isCloudSqlAvailable()) {
    addRegistrationInCloudSql({
      id: newReg.id,
      eventId: newReg.eventId,
      eventTitle: newReg.eventTitle,
      fullName: newReg.name,
      email: newReg.email,
      prn: newReg.prn,
      department: newReg.branch,
      yearSemester: newReg.year,
      phone: newReg.phone,
      college: 'Sanjivani University',
      timestamp: newReg.timestamp,
      createdDate: new Date().toLocaleDateString('en-IN'),
      verified: true
    }).catch(e => console.error('[Cloud SQL] Registration save error:', e));
  }

  res.json({ ok: true, data: newReg });
});

// 4. File / Photo Upload API
app.post('/api/upload', (req, res) => {
  const { dataUri, base64, prefix } = req.body;
  const imgStr = dataUri || base64;
  if (!imgStr) {
    return res.status(400).json({ ok: false, error: 'No image data provided.' });
  }
  const url = saveBase64Image(imgStr, prefix || 'photo');
  res.json({ ok: true, url });
});

/* =========================================================================
   ADMINISTRATOR AUTHORIZATION & CONTROL DISPATCHER
   ========================================================================= */

// Check if request is authenticated as MESA Admin
function verifyAdmin(key, db) {
  if (!key) return false;
  const cleanKey = String(key).trim();
  if (!cleanKey) return false;
  const configuredKey = String(db.adminKey || process.env.MESA_ADMIN_KEY || '').trim();
  if (!configuredKey) return false;
  return cleanKey === configuredKey;
}

// Master Admin Call endpoint
app.post('/api/admin/call', (req, res) => {
  const { key, action, payload = {}, id = null } = req.body;
  const db = getDB();

  // 1. Action: Login / Verify
  if (action === 'login' || action === 'verify') {
    if (verifyAdmin(key, db)) {
      return res.json({
        ok: true,
        message: 'MESA administrator authorization verified.',
        role: 'admin',
        data: {
          members: db.members || [],
          events: db.events || [],
          gallery: db.gallery || [],
          inquiries: db.inquiries || [],
          registrations: db.registrations || [],
          privacyMode: db.privacyMode || 'masked',
          customLogoUrl: db.customLogoUrl || null
        }
      });
    }
    return res.status(401).json({
      ok: false,
      error: 'Invalid authorization key'
    });
  }

  // Guard all subsequent admin operations
  if (!verifyAdmin(key, db)) {
    return res.status(403).json({
      ok: false,
      error: 'Invalid authorization key'
    });
  }

  // 2. Action: Load All Admin Data
  if (action === 'load') {
    return res.json({
      ok: true,
      members: db.members || [],
      events: db.events || [],
      gallery: db.gallery || [],
      inquiries: db.inquiries || [],
      registrations: db.registrations || [],
      privacyMode: db.privacyMode || 'masked',
      customLogoUrl: db.customLogoUrl || null
    });
  }

  // 3. Action: Upload Member Photo
  if (action === 'upload_member_photo') {
    const base64 = payload.base64 || payload.photo;
    const url = saveBase64Image(base64, 'member');
    return res.json({ ok: true, url });
  }

  // 4. Action: Member Create
  if (action === 'member_create') {
    const rawPhoto = payload.photo || payload.photo_url;
    const savedPhoto = saveBase64Image(rawPhoto, 'member') || 'https://placehold.co/400x400/0b1b3d/ffffff?text=MESA';
    
    const newMember = {
      id: 'stu-' + Date.now(),
      name: (payload.name || payload.full_name || 'COUNCIL MEMBER').toUpperCase(),
      position: payload.position || 'Council Member',
      designationTitle: payload.committee || payload.designationTitle || 'Council Member',
      category: payload.category || payload.committee || 'member',
      department: payload.department || 'Mechanical Engineering',
      academic_year: payload.academic_year || '2026–2027',
      year: payload.year || payload.year_of_study || 'Third Year B.Tech',
      semester: payload.semester || 'Semester V',
      prn: payload.prn || payload.prn_number || '',
      mobile: payload.mobile || '',
      email: payload.email || '',
      responsibilities: payload.responsibilities || payload.bio || 'Active MESA Council Member.',
      photo: savedPhoto,
      isFaculty: payload.category === 'faculty' || payload.committee === 'faculty'
    };

    if (!db.members) db.members = [];
    db.members.push(newMember);
    saveDB(db);

    if (isCloudSqlAvailable()) {
      upsertMemberInCloudSql(newMember).catch(e => console.error('[Cloud SQL] Member save error:', e));
    }

    return res.json({ ok: true, data: newMember });
  }

  // 5. Action: Member Update
  if (action === 'member_update') {
    const memberId = id || payload.id;
    const idx = (db.members || []).findIndex(m => m.id === memberId);
    if (idx === -1) {
      return res.status(404).json({ ok: false, error: 'Member not found.' });
    }

    const current = db.members[idx];
    let photo = current.photo;
    if (payload.photo || payload.photo_url) {
      photo = saveBase64Image(payload.photo || payload.photo_url, 'member');
    }

    const updated = {
      ...current,
      name: (payload.name || payload.full_name || current.name).toUpperCase(),
      position: payload.position !== undefined ? payload.position : current.position,
      category: payload.category || payload.committee || current.category,
      designationTitle: payload.committee || payload.designationTitle || current.designationTitle,
      academic_year: payload.academic_year || current.academic_year,
      year: payload.year || payload.year_of_study || current.year,
      semester: payload.semester !== undefined ? payload.semester : current.semester,
      prn: payload.prn || payload.prn_number || current.prn,
      mobile: payload.mobile !== undefined ? payload.mobile : current.mobile,
      email: payload.email !== undefined ? payload.email : current.email,
      responsibilities: payload.responsibilities || payload.bio || current.responsibilities,
      photo: photo,
      isFaculty: (payload.category || payload.committee) === 'faculty'
    };

    db.members[idx] = updated;
    saveDB(db);

    if (isCloudSqlAvailable()) {
      upsertMemberInCloudSql(updated).catch(e => console.error('[Cloud SQL] Member update error:', e));
    }

    return res.json({ ok: true, data: updated });
  }

  // 6. Action: Member Delete
  if (action === 'member_delete') {
    const memberId = id || payload.id;
    db.members = (db.members || []).filter(m => m.id !== memberId);
    saveDB(db);

    if (isCloudSqlAvailable()) {
      deleteMemberInCloudSql(memberId).catch(e => console.error('[Cloud SQL] Member delete error:', e));
    }

    return res.json({ ok: true, message: 'Member deleted.' });
  }

  // 7. Action: Event Create
  if (action === 'event_create') {
    const rawQr = payload.phonepeQr || payload.phonepe_qr || null;
    const savedQr = rawQr ? saveBase64Image(rawQr, 'qr') : null;

    const newEvent = {
      id: 'evt-' + Date.now(),
      title: payload.title || 'New MESA Event',
      tag: payload.tag || payload.category || 'Workshop',
      date: payload.date || payload.event_date || 'Upcoming 2026',
      startTime: payload.startTime || payload.start_time || '09:30 AM',
      endTime: payload.endTime || payload.end_time || '04:30 PM',
      venue: payload.venue || 'Sanjivani University',
      organizer: payload.organizer || 'MESA Council & Department of Mechanical Engineering',
      eligibility: payload.eligibility || 'Open to all Engineering students across all branches',
      rules: payload.rules || '1. Valid College ID is mandatory.\n2. Report 15 minutes before the start time.\n3. Follow all workshop/competition guidelines.',
      deadline: payload.deadline || payload.registration_deadline || '',
      maxParticipants: payload.maxParticipants ? Number(payload.maxParticipants) : 100,
      entryType: (payload.entryType || payload.entry_type || 'free').toLowerCase(),
      fee: payload.fee ? Number(payload.fee) : 0,
      status: (payload.status || (payload.registration_enabled !== false ? 'OPEN' : 'CLOSED')).toUpperCase(),
      phonepeUpi: payload.phonepeUpi || payload.phonepe_upi || 'sanjivani.mesa@ybl',
      phonepeQr: savedQr || null,
      contactName: payload.contactName || payload.contact_name || 'Prof. Pankaj Patil (MESA Coordinator)',
      contactPhone: payload.contactPhone || payload.contact_phone || '+91 94237 88910',
      contactEmail: payload.contactEmail || payload.contact_email || 'mesa@sanjivani.edu.in',
      badgeText: payload.badgeText || (payload.entryType === 'paid' ? 'Paid Entry' : 'Free Entry'),
      desc: payload.desc || payload.description || '',
      icon: payload.icon || 'fa-calendar-check',
      gradient: payload.gradient || 'from-sanjivani-navy to-sanjivani-blue'
    };

    if (!db.events) db.events = [];
    db.events.unshift(newEvent);
    saveDB(db);

    if (isCloudSqlAvailable()) {
      upsertEventInCloudSql(newEvent).catch(e => console.error('[Cloud SQL] Event save error:', e));
    }

    return res.json({ ok: true, data: newEvent });
  }

  // 8. Action: Event Update
  if (action === 'event_update') {
    const eventId = id || payload.id;
    const idx = (db.events || []).findIndex(e => e.id === eventId);
    if (idx === -1) {
      return res.status(404).json({ ok: false, error: 'Event not found.' });
    }

    const current = db.events[idx];
    const rawQr = payload.phonepeQr || payload.phonepe_qr;
    const savedQr = rawQr ? saveBase64Image(rawQr, 'qr') : (rawQr === null ? null : current.phonepeQr);

    const updated = {
      ...current,
      title: payload.title !== undefined ? payload.title : current.title,
      tag: payload.tag || payload.category || current.tag,
      date: payload.date || payload.event_date || current.date,
      startTime: payload.startTime !== undefined ? payload.startTime : current.startTime,
      endTime: payload.endTime !== undefined ? payload.endTime : current.endTime,
      venue: payload.venue !== undefined ? payload.venue : current.venue,
      organizer: payload.organizer !== undefined ? payload.organizer : current.organizer,
      eligibility: payload.eligibility !== undefined ? payload.eligibility : current.eligibility,
      rules: payload.rules !== undefined ? payload.rules : current.rules,
      deadline: payload.deadline !== undefined ? payload.deadline : current.deadline,
      maxParticipants: payload.maxParticipants !== undefined ? Number(payload.maxParticipants) : current.maxParticipants,
      entryType: payload.entryType !== undefined ? payload.entryType.toLowerCase() : current.entryType,
      fee: payload.fee !== undefined ? Number(payload.fee) : current.fee,
      status: payload.status !== undefined ? payload.status.toUpperCase() : current.status,
      phonepeUpi: payload.phonepeUpi !== undefined ? payload.phonepeUpi : current.phonepeUpi,
      phonepeQr: savedQr,
      contactName: payload.contactName !== undefined ? payload.contactName : current.contactName,
      contactPhone: payload.contactPhone !== undefined ? payload.contactPhone : current.contactPhone,
      contactEmail: payload.contactEmail !== undefined ? payload.contactEmail : current.contactEmail,
      badgeText: payload.badgeText !== undefined ? payload.badgeText : current.badgeText,
      desc: payload.desc !== undefined ? payload.desc : (payload.description !== undefined ? payload.description : current.desc),
      gradient: payload.gradient || current.gradient,
      icon: payload.icon || current.icon
    };

    db.events[idx] = updated;
    saveDB(db);

    if (isCloudSqlAvailable()) {
      upsertEventInCloudSql(updated).catch(e => console.error('[Cloud SQL] Event update error:', e));
    }

    return res.json({ ok: true, data: updated });
  }

  // 8b. Action: Toggle Event Status (OPEN / CLOSED)
  if (action === 'event_toggle_status') {
    const eventId = id || payload.id;
    const idx = (db.events || []).findIndex(e => e.id === eventId);
    if (idx === -1) {
      return res.status(404).json({ ok: false, error: 'Event not found.' });
    }
    const currentStatus = (db.events[idx].status || 'OPEN').toUpperCase();
    const newStatus = (currentStatus === 'CLOSED') ? 'OPEN' : 'CLOSED';
    db.events[idx].status = newStatus;
    saveDB(db);

    if (isCloudSqlAvailable()) {
      upsertEventInCloudSql(db.events[idx]).catch(e => console.error('[Cloud SQL] Event status toggle error:', e));
    }

    return res.json({ ok: true, data: db.events[idx], status: newStatus, message: `Event registration status set to ${newStatus}` });
  }

  // 9. Action: Event Delete
  if (action === 'event_delete') {
    const eventId = id || payload.id;
    db.events = (db.events || []).filter(e => e.id !== eventId);
    saveDB(db);

    if (isCloudSqlAvailable()) {
      deleteEventInCloudSql(eventId).catch(e => console.error('[Cloud SQL] Event delete error:', e));
    }

    return res.json({ ok: true, message: 'Event deleted.' });
  }

  // 10. Action: Gallery Create
  if (action === 'gallery_create') {
    const rawImage = payload.image || payload.image_url;
    const savedImage = saveBase64Image(rawImage, 'gallery');

    const newPhoto = {
      id: 'gal-' + Date.now(),
      title: payload.title || 'MESA Highlight',
      category: payload.category || 'Event',
      desc: payload.desc || payload.description || '',
      image: savedImage || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80'
    };

    if (!db.gallery) db.gallery = [];
    db.gallery.unshift(newPhoto);
    saveDB(db);

    if (isCloudSqlAvailable()) {
      upsertGalleryInCloudSql(newPhoto).catch(e => console.error('[Cloud SQL] Gallery save error:', e));
    }

    return res.json({ ok: true, data: newPhoto });
  }

  // 11. Action: Gallery Delete
  if (action === 'gallery_delete') {
    const photoId = id || payload.id;
    db.gallery = (db.gallery || []).filter(g => g.id !== photoId);
    saveDB(db);

    if (isCloudSqlAvailable()) {
      deleteGalleryInCloudSql(photoId).catch(e => console.error('[Cloud SQL] Gallery delete error:', e));
    }

    return res.json({ ok: true, message: 'Gallery item deleted.' });
  }

  // 12. Action: Inquiry Delete & Clear
  if (action === 'inquiry_delete') {
    const inquiryId = id || payload.id;
    db.inquiries = (db.inquiries || []).filter(i => i.id !== inquiryId);
    saveDB(db);
    return res.json({ ok: true, message: 'Inquiry deleted.' });
  }
  if (action === 'clear_inquiries') {
    db.inquiries = [];
    saveDB(db);
    return res.json({ ok: true, message: 'All inquiries cleared.' });
  }

  // 13. Action: Registration Delete & Clear
  if (action === 'registration_delete') {
    const regId = id || payload.id;
    db.registrations = (db.registrations || []).filter(r => r.id !== regId);
    saveDB(db);

    if (isCloudSqlAvailable()) {
      deleteRegistrationInCloudSql(regId).catch(e => console.error('[Cloud SQL] Registration delete error:', e));
    }

    return res.json({ ok: true, message: 'Registration deleted.' });
  }
  if (action === 'clear_registrations') {
    db.registrations = [];
    saveDB(db);

    if (isCloudSqlAvailable()) {
      clearRegistrationsInCloudSql().catch(e => console.error('[Cloud SQL] Registration clear error:', e));
    }

    return res.json({ ok: true, message: 'All registrations cleared.' });
  }

  // 14. Action: Change Admin Key
  if (action === 'change_admin_key' || action === 'update_key') {
    const newKey = (payload.newKey || '').trim();
    if (newKey) {
      db.adminKey = newKey;
      saveDB(db);
      return res.json({ ok: true, key: newKey, message: 'Administrator key updated successfully.' });
    }
    return res.status(400).json({ ok: false, error: 'Key cannot be empty.' });
  }

  // 15. Action: Privacy Setting
  if (action === 'update_privacy' || action === 'privacy_mode') {
    db.privacyMode = payload.mode || 'masked';
    saveDB(db);

    if (isCloudSqlAvailable()) {
      setSettingInCloudSql('privacy_mode', db.privacyMode).catch(e => console.error('[Cloud SQL] Privacy mode error:', e));
    }

    return res.json({ ok: true, mode: db.privacyMode });
  }

  // 16. Action: Update / Reset Custom Crest Logo
  if (action === 'update_logo' || action === 'crest_logo') {
    const raw = payload.image || payload.dataUrl || payload.url;
    if (!raw) {
      db.customLogoUrl = null;
      saveDB(db);
      if (isCloudSqlAvailable()) {
        setSettingInCloudSql('custom_logo_url', null).catch(() => {});
      }
      return res.json({ ok: true, customLogoUrl: null, message: 'Restored default vector crest.' });
    }
    const savedUrl = saveBase64Image(raw, 'crest');
    db.customLogoUrl = savedUrl || raw;
    saveDB(db);
    if (isCloudSqlAvailable()) {
      setSettingInCloudSql('custom_logo_url', db.customLogoUrl).catch(() => {});
    }
    return res.json({ ok: true, customLogoUrl: db.customLogoUrl, message: 'Custom university crest updated and saved.' });
  }

  // 17. Action: Export Full Database (For local backup & safety)
  if (action === 'export_database' || action === 'export_db') {
    return res.json({
      ok: true,
      filename: `mesa_database_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      database: db,
      meta: {
        exportedAt: new Date().toISOString(),
        memberCount: (db.members || []).length,
        eventCount: (db.events || []).length,
        galleryCount: (db.gallery || []).length,
        registrationCount: (db.registrations || []).length,
        inquiryCount: (db.inquiries || []).length,
        isCloudSql: isCloudSqlAvailable()
      }
    });
  }

  // 18. Action: Import Database from Backup
  if (action === 'import_database' || action === 'restore_backup') {
    const rawData = payload.database || payload.data || payload;
    let imported = null;
    if (typeof rawData === 'string') {
      try { imported = JSON.parse(rawData); } catch (e) {
        return res.status(400).json({ ok: false, error: 'Invalid JSON file provided.' });
      }
    } else if (typeof rawData === 'object') {
      imported = rawData;
    }

    if (!imported || (!Array.isArray(imported.members) && !Array.isArray(imported.events))) {
      return res.status(400).json({ ok: false, error: 'Uploaded data is missing essential council records (members/events).' });
    }

    // Merge or replace
    if (Array.isArray(imported.members) && imported.members.length > 0) db.members = imported.members;
    if (Array.isArray(imported.events)) db.events = imported.events;
    if (Array.isArray(imported.gallery)) db.gallery = imported.gallery;
    if (Array.isArray(imported.registrations)) db.registrations = imported.registrations;
    if (Array.isArray(imported.inquiries)) db.inquiries = imported.inquiries;
    if (imported.privacyMode) db.privacyMode = imported.privacyMode;
    if (imported.customLogoUrl !== undefined) db.customLogoUrl = imported.customLogoUrl;

    saveDB(db);
    return res.json({
      ok: true,
      message: `Database restored: ${db.members.length} members, ${db.events.length} events, ${db.registrations.length} registrations.`,
      data: db
    });
  }

  // 19. Action: Reset to Official Verified 2026-2027 Roster
  if (action === 'restore_defaults' || action === 'reset_seed') {
    const seed = loadSeedOrBackupDB();
    if (!seed) {
      return res.status(500).json({ ok: false, error: 'Verified seed database file not found on server.' });
    }
    db.members = seed.members;
    db.events = seed.events;
    db.gallery = seed.gallery;
    saveDB(db);

    if (isCloudSqlAvailable()) {
      seedCloudSqlIfEmpty(seed).catch(e => console.error('[Cloud SQL] Restore error:', e));
    }

    return res.json({
      ok: true,
      message: 'Restored official 2026–2027 Sanjivani University MESA Council roster and events.',
      data: db
    });
  }

  // 20. Action: Database Status & Health Check
  if (action === 'database_status' || action === 'db_health') {
    return res.json({
      ok: true,
      status: isCloudSqlAvailable() ? 'PERMANENT_CLOUD_SQL' : 'PERMANENT_PROTECTED',
      isCloudSql: isCloudSqlAvailable(),
      cloudSqlRegion: 'asia-southeast1',
      memberCount: (db.members || []).length,
      eventCount: (db.events || []).length,
      galleryCount: (db.gallery || []).length,
      registrationCount: (db.registrations || []).length,
      inquiryCount: (db.inquiries || []).length,
      hasBackup: fs.existsSync(DB_BACKUP_FILE),
      hasSeed: fs.existsSync(DB_SEED_FILE)
    });
  }

  return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
});

// Serve public website static files
app.use(express.static(__dirname));

// Fallback to index.html for all other page navigations
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// In local/container environments, start the HTTP server.
// In Vercel or serverless environments, Vercel imports the app handler.
if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log(`MESA Portal server running on http://${HOST}:${PORT}`);
  });
}

export default app;
