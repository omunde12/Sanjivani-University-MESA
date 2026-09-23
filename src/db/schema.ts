import { pgTable, text, serial, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

// Mandatory users table for Firebase Auth synchronization
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Official MESA Council Members Table
export const mesaMembers = pgTable('mesa_members', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  position: text('position').notNull(),
  designationTitle: text('designation_title'),
  category: text('category').notNull(),
  department: text('department').default('Mechanical Engineering'),
  academicYear: text('academic_year').default('2026–2027'),
  year: text('year'),
  semester: text('semester'),
  prn: text('prn'),
  mobile: text('mobile'),
  email: text('email'),
  responsibilities: text('responsibilities'),
  photo: text('photo'),
  isFaculty: boolean('is_faculty').default(false),
  sortOrder: integer('sort_order').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Official Department Events Table
export const mesaEvents = pgTable('mesa_events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  tagline: text('tagline'),
  category: text('category'),
  date: text('date'),
  time: text('time'),
  venue: text('venue'),
  description: text('description'),
  highlights: text('highlights'),
  registrationFee: text('registration_fee'),
  status: text('status'),
  coordinator: text('coordinator'),
  contact: text('contact'),
  poster: text('poster'),
  // Additional rich event metadata columns
  tag: text('tag'),
  startTime: text('start_time'),
  endTime: text('end_time'),
  organizer: text('organizer'),
  eligibility: text('eligibility'),
  rules: text('rules'),
  deadline: text('deadline'),
  maxParticipants: integer('max_participants').default(100),
  entryType: text('entry_type').default('free'),
  fee: integer('fee').default(0),
  phonepeUpi: text('phonepe_upi'),
  phonepeQr: text('phonepe_qr'),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  badgeText: text('badge_text'),
  desc: text('desc'),
  icon: text('icon'),
  gradient: text('gradient'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// High-Definition Gallery Highlights Table
export const mesaGallery = pgTable('mesa_gallery', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category'),
  desc: text('desc'),
  image: text('image').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Student Event Registrations Table
export const mesaRegistrations = pgTable('mesa_registrations', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  eventTitle: text('event_title').notNull(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  prn: text('prn').notNull(),
  department: text('department'),
  yearSemester: text('year_semester'),
  phone: text('phone'),
  college: text('college'),
  timestamp: text('timestamp'),
  createdDate: text('created_date'),
  verified: boolean('verified').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Official Contact & Inquiries Table
export const mesaInquiries = pgTable('mesa_inquiries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  subject: text('subject'),
  message: text('message').notNull(),
  date: text('date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Portal Key-Value Settings (Privacy mode, Custom Crest Logo, Admin Config)
export const mesaSettings = pgTable('mesa_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow(),
});
