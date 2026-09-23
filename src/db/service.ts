import { db } from './index.ts';
import {
  mesaMembers,
  mesaEvents,
  mesaGallery,
  mesaRegistrations,
  mesaInquiries,
  mesaSettings
} from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export function isCloudSqlAvailable(): boolean {
  return !!(
    process.env.SQL_HOST &&
    process.env.SQL_USER &&
    process.env.SQL_PASSWORD &&
    process.env.SQL_DB_NAME
  );
}

// Check and seed Cloud SQL database from golden seed data if empty
export async function seedCloudSqlIfEmpty(seedData: any) {
  if (!isCloudSqlAvailable() || !seedData) return;

  try {
    const existingMembers = await db.select({ id: mesaMembers.id }).from(mesaMembers).limit(1);
    if (existingMembers.length === 0 && Array.isArray(seedData.members) && seedData.members.length > 0) {
      console.log('[Cloud SQL] Seeding initial 2026–2027 council records...');

      for (const m of seedData.members) {
        await db.insert(mesaMembers).values({
          id: m.id,
          name: m.name,
          position: m.position,
          designationTitle: m.designationTitle || m.position,
          category: m.category,
          department: m.department || 'Mechanical Engineering',
          academicYear: m.academic_year || '2026–2027',
          year: m.year || '',
          semester: m.semester || '',
          prn: m.prn || '',
          mobile: m.mobile || '',
          email: m.email || '',
          responsibilities: m.responsibilities || '',
          photo: m.photo || '',
          isFaculty: !!m.isFaculty,
          sortOrder: m.sortOrder || 0
        }).onConflictDoNothing();
      }
    }

    // Seed events if empty
    const existingEvents = await db.select({ id: mesaEvents.id }).from(mesaEvents).limit(1);
    if (existingEvents.length === 0 && Array.isArray(seedData.events)) {
      for (const ev of seedData.events) {
        await db.insert(mesaEvents).values({
          id: ev.id,
          title: ev.title,
          tag: ev.tag || ev.category || 'Technical Event',
          date: ev.date || '',
          startTime: ev.startTime || '',
          endTime: ev.endTime || '',
          venue: ev.venue || '',
          organizer: ev.organizer || 'Department of Mechanical Engineering & MESA',
          eligibility: ev.eligibility || 'Open to all Engineering students',
          rules: ev.rules || '',
          deadline: ev.deadline || '',
          maxParticipants: ev.maxParticipants ? Number(ev.maxParticipants) : 100,
          entryType: (ev.entryType || (ev.fee > 0 ? 'paid' : 'free')).toLowerCase(),
          fee: ev.fee ? Number(ev.fee) : 0,
          status: (ev.status || 'OPEN').toUpperCase(),
          phonepeUpi: ev.phonepeUpi || 'sanjivani.mesa@ybl',
          phonepeQr: ev.phonepeQr || null,
          contactName: ev.contactName || ev.coordinator || 'Prof. Pankaj Patil',
          contactPhone: ev.contactPhone || ev.contact || '+91 94237 88910',
          contactEmail: ev.contactEmail || 'mesa@sanjivani.edu.in',
          badgeText: ev.badgeText || (ev.fee > 0 ? `Paid Entry • ₹${ev.fee}` : 'Free Entry'),
          desc: ev.desc || ev.description || '',
          icon: ev.icon || 'fa-calendar-check',
          gradient: ev.gradient || 'from-sanjivani-navy to-sanjivani-blue',
          tagline: ev.tagline || '',
          category: ev.category || ev.tag || '',
          time: ev.time || `${ev.startTime || ''} - ${ev.endTime || ''}`.trim(),
          description: ev.description || ev.desc || '',
          highlights: ev.highlights || '',
          registrationFee: ev.registrationFee || (ev.fee ? `₹${ev.fee}` : 'Free'),
          coordinator: ev.coordinator || ev.contactName || '',
          contact: ev.contact || ev.contactPhone || '',
          poster: ev.poster || ''
        }).onConflictDoNothing();
      }
    }

    // Seed gallery if empty
    const existingGallery = await db.select({ id: mesaGallery.id }).from(mesaGallery).limit(1);
    if (existingGallery.length === 0 && Array.isArray(seedData.gallery)) {
      for (const g of seedData.gallery) {
        await db.insert(mesaGallery).values({
          id: g.id,
          title: g.title,
          category: g.category || '',
          desc: g.desc || '',
          image: g.image
        }).onConflictDoNothing();
      }
    }

    // Seed initial registrations if empty
    const existingRegs = await db.select({ id: mesaRegistrations.id }).from(mesaRegistrations).limit(1);
    if (existingRegs.length === 0 && Array.isArray(seedData.registrations)) {
      for (const r of seedData.registrations) {
        await db.insert(mesaRegistrations).values({
          id: r.id,
          eventId: r.eventId || 'evt-cad-2026',
          eventTitle: r.eventTitle || 'MESA Event',
          fullName: r.fullName || r.studentName || r.name || 'Participant',
          email: r.email || 'Not provided',
          prn: r.prn || '',
          department: r.department || '',
          yearSemester: r.yearSemester || r.year_semester || '',
          phone: r.phone || r.mobile || '',
          college: r.college || '',
          timestamp: r.timestamp || '',
          createdDate: r.createdDate || r.created_date || '',
          verified: r.verified !== false
        }).onConflictDoNothing();
      }
    }

    // Seed initial inquiries if empty
    const existingInquiries = await db.select({ id: mesaInquiries.id }).from(mesaInquiries).limit(1);
    if (existingInquiries.length === 0 && Array.isArray(seedData.inquiries)) {
      for (const inq of seedData.inquiries) {
        await db.insert(mesaInquiries).values({
          id: inq.id,
          name: inq.name,
          email: inq.email,
          phone: inq.phone || '',
          subject: inq.subject || '',
          message: inq.message,
          date: inq.date || ''
        }).onConflictDoNothing();
      }
    }

    // Seed initial settings
    await db.insert(mesaSettings).values({
      key: 'privacy_mode',
      value: seedData.privacyMode || 'masked'
    }).onConflictDoUpdate({ target: mesaSettings.key, set: { value: seedData.privacyMode || 'masked' } });

    if (seedData.customLogoUrl) {
      await db.insert(mesaSettings).values({
        key: 'custom_logo_url',
        value: seedData.customLogoUrl
      }).onConflictDoUpdate({ target: mesaSettings.key, set: { value: seedData.customLogoUrl } });
    }

    console.log('[Cloud SQL] Database state verified and synced!');
  } catch (error) {
    console.error('[Cloud SQL] Seeding error:', error);
  }
}

// Fetch all portal records from Cloud SQL
export async function getCloudSqlPortalData() {
  try {
    const [members, events, gallery, registrations, inquiries, settings] = await Promise.all([
      db.select().from(mesaMembers),
      db.select().from(mesaEvents),
      db.select().from(mesaGallery),
      db.select().from(mesaRegistrations).orderBy(desc(mesaRegistrations.createdAt)),
      db.select().from(mesaInquiries).orderBy(desc(mesaInquiries.createdAt)),
      db.select().from(mesaSettings)
    ]);

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    // Format members back to frontend schema
    const formattedMembers = members.map(m => ({
      id: m.id,
      name: m.name,
      position: m.position,
      designationTitle: m.designationTitle || m.position,
      category: m.category,
      department: m.department || 'Mechanical Engineering',
      academic_year: m.academicYear || '2026–2027',
      year: m.year || '',
      semester: m.semester || '',
      prn: m.prn || '',
      mobile: m.mobile || '',
      email: m.email || '',
      responsibilities: m.responsibilities || '',
      photo: m.photo || '',
      isFaculty: !!m.isFaculty,
      sortOrder: m.sortOrder || 0
    }));

    // Format events back to frontend schema
    const formattedEvents = events.map(e => ({
      id: e.id,
      title: e.title,
      tag: e.tag || e.category || 'Technical Event',
      date: e.date || '',
      startTime: e.startTime || '',
      endTime: e.endTime || '',
      venue: e.venue || '',
      organizer: e.organizer || 'Department of Mechanical Engineering & MESA',
      eligibility: e.eligibility || 'Open to all Engineering students across all branches',
      rules: e.rules || '1. Valid College ID is mandatory.\n2. Report 15 minutes before the start time.\n3. Follow all workshop/competition guidelines.',
      deadline: e.deadline || '',
      maxParticipants: e.maxParticipants || 100,
      entryType: e.entryType || (e.fee && e.fee > 0 ? 'paid' : 'free'),
      fee: e.fee || 0,
      status: (e.status || 'OPEN').toUpperCase(),
      phonepeUpi: e.phonepeUpi || 'sanjivani.mesa@ybl',
      phonepeQr: e.phonepeQr || null,
      contactName: e.contactName || e.coordinator || 'Prof. Pankaj Patil (MESA Coordinator)',
      contactPhone: e.contactPhone || e.contact || '+91 94237 88910',
      contactEmail: e.contactEmail || 'mesa@sanjivani.edu.in',
      badgeText: e.badgeText || (e.fee && e.fee > 0 ? `Paid Entry • ₹${e.fee}` : 'Free Entry'),
      desc: e.desc || e.description || '',
      icon: e.icon || 'fa-calendar-check',
      gradient: e.gradient || 'from-sanjivani-navy to-sanjivani-blue'
    }));

    return {
      members: formattedMembers,
      events: formattedEvents,
      gallery,
      registrations,
      inquiries,
      privacyMode: settingsMap.get('privacy_mode') || 'masked',
      customLogoUrl: settingsMap.get('custom_logo_url') || null
    };
  } catch (error) {
    console.error('[Cloud SQL] Query failed:', error);
    throw new Error('Failed to retrieve portal data from Cloud SQL', { cause: error });
  }
}

// Member operations
export async function upsertMemberInCloudSql(member: any) {
  try {
    await db.insert(mesaMembers).values({
      id: member.id,
      name: member.name,
      position: member.position,
      designationTitle: member.designationTitle || member.position,
      category: member.category,
      department: member.department || 'Mechanical Engineering',
      academicYear: member.academic_year || '2026–2027',
      year: member.year || '',
      semester: member.semester || '',
      prn: member.prn || '',
      mobile: member.mobile || '',
      email: member.email || '',
      responsibilities: member.responsibilities || '',
      photo: member.photo || '',
      isFaculty: !!member.isFaculty,
      sortOrder: member.sortOrder || 0,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: mesaMembers.id,
      set: {
        name: member.name,
        position: member.position,
        designationTitle: member.designationTitle || member.position,
        category: member.category,
        department: member.department || 'Mechanical Engineering',
        academicYear: member.academic_year || '2026–2027',
        year: member.year || '',
        semester: member.semester || '',
        prn: member.prn || '',
        mobile: member.mobile || '',
        email: member.email || '',
        responsibilities: member.responsibilities || '',
        photo: member.photo || '',
        isFaculty: !!member.isFaculty,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('[Cloud SQL] Upsert member failed:', error);
    throw new Error('Failed to upsert member in Cloud SQL', { cause: error });
  }
}

export async function deleteMemberInCloudSql(id: string) {
  try {
    await db.delete(mesaMembers).where(eq(mesaMembers.id, id));
  } catch (error) {
    console.error('[Cloud SQL] Delete member failed:', error);
    throw new Error('Failed to delete member in Cloud SQL', { cause: error });
  }
}

// Event operations
export async function upsertEventInCloudSql(event: any) {
  try {
    const eventValues = {
      id: event.id,
      title: event.title,
      tag: event.tag || event.category || 'Technical Event',
      date: event.date || '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      venue: event.venue || '',
      organizer: event.organizer || 'Department of Mechanical Engineering & MESA',
      eligibility: event.eligibility || 'Open to all Engineering students across all branches',
      rules: event.rules || '',
      deadline: event.deadline || '',
      maxParticipants: event.maxParticipants ? Number(event.maxParticipants) : 100,
      entryType: (event.entryType || (event.fee > 0 ? 'paid' : 'free')).toLowerCase(),
      fee: event.fee ? Number(event.fee) : 0,
      status: (event.status || 'OPEN').toUpperCase(),
      phonepeUpi: event.phonepeUpi || 'sanjivani.mesa@ybl',
      phonepeQr: event.phonepeQr || null,
      contactName: event.contactName || event.coordinator || 'Prof. Pankaj Patil (MESA Coordinator)',
      contactPhone: event.contactPhone || event.contact || '+91 94237 88910',
      contactEmail: event.contactEmail || 'mesa@sanjivani.edu.in',
      badgeText: event.badgeText || (event.fee > 0 ? `Paid Entry • ₹${event.fee}` : 'Free Entry'),
      desc: event.desc || event.description || '',
      icon: event.icon || 'fa-calendar-check',
      gradient: event.gradient || 'from-sanjivani-navy to-sanjivani-blue',
      tagline: event.tagline || event.tag || '',
      category: event.category || event.tag || '',
      time: event.time || `${event.startTime || ''} - ${event.endTime || ''}`.trim(),
      description: event.description || event.desc || '',
      highlights: event.highlights || '',
      registrationFee: event.registrationFee || (event.fee ? `₹${event.fee}` : 'Free'),
      coordinator: event.coordinator || event.contactName || '',
      contact: event.contact || event.contactPhone || '',
      poster: event.poster || '',
      updatedAt: new Date()
    };

    await db.insert(mesaEvents).values(eventValues).onConflictDoUpdate({
      target: mesaEvents.id,
      set: {
        title: eventValues.title,
        tag: eventValues.tag,
        date: eventValues.date,
        startTime: eventValues.startTime,
        endTime: eventValues.endTime,
        venue: eventValues.venue,
        organizer: eventValues.organizer,
        eligibility: eventValues.eligibility,
        rules: eventValues.rules,
        deadline: eventValues.deadline,
        maxParticipants: eventValues.maxParticipants,
        entryType: eventValues.entryType,
        fee: eventValues.fee,
        status: eventValues.status,
        phonepeUpi: eventValues.phonepeUpi,
        phonepeQr: eventValues.phonepeQr,
        contactName: eventValues.contactName,
        contactPhone: eventValues.contactPhone,
        contactEmail: eventValues.contactEmail,
        badgeText: eventValues.badgeText,
        desc: eventValues.desc,
        icon: eventValues.icon,
        gradient: eventValues.gradient,
        tagline: eventValues.tagline,
        category: eventValues.category,
        time: eventValues.time,
        description: eventValues.description,
        highlights: eventValues.highlights,
        registrationFee: eventValues.registrationFee,
        coordinator: eventValues.coordinator,
        contact: eventValues.contact,
        poster: eventValues.poster,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('[Cloud SQL] Upsert event failed:', error);
    throw new Error('Failed to upsert event in Cloud SQL', { cause: error });
  }
}

export async function deleteEventInCloudSql(id: string) {
  try {
    await db.delete(mesaEvents).where(eq(mesaEvents.id, id));
  } catch (error) {
    console.error('[Cloud SQL] Delete event failed:', error);
    throw new Error('Failed to delete event in Cloud SQL', { cause: error });
  }
}

// Gallery operations
export async function upsertGalleryInCloudSql(item: any) {
  try {
    await db.insert(mesaGallery).values({
      id: item.id,
      title: item.title,
      category: item.category || '',
      desc: item.desc || '',
      image: item.image,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: mesaGallery.id,
      set: {
        title: item.title,
        category: item.category || '',
        desc: item.desc || '',
        image: item.image,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('[Cloud SQL] Upsert gallery failed:', error);
    throw new Error('Failed to upsert gallery in Cloud SQL', { cause: error });
  }
}

export async function deleteGalleryInCloudSql(id: string) {
  try {
    await db.delete(mesaGallery).where(eq(mesaGallery.id, id));
  } catch (error) {
    console.error('[Cloud SQL] Delete gallery failed:', error);
    throw new Error('Failed to delete gallery in Cloud SQL', { cause: error });
  }
}

// Registration operations
export async function addRegistrationInCloudSql(reg: any) {
  try {
    await db.insert(mesaRegistrations).values({
      id: reg.id,
      eventId: reg.eventId || 'evt-cad-2026',
      eventTitle: reg.eventTitle || 'MESA Event',
      fullName: reg.fullName || reg.studentName || reg.name || 'Participant',
      email: reg.email || 'Not provided',
      prn: reg.prn || '',
      department: reg.department || '',
      yearSemester: reg.yearSemester || reg.year_semester || '',
      phone: reg.phone || reg.mobile || '',
      college: reg.college || '',
      timestamp: reg.timestamp || '',
      createdDate: reg.createdDate || reg.created_date || '',
      verified: reg.verified !== false
    }).onConflictDoNothing();
  } catch (error) {
    console.error('[Cloud SQL] Add registration failed:', error);
    throw new Error('Failed to add registration in Cloud SQL', { cause: error });
  }
}

export async function deleteRegistrationInCloudSql(id: string) {
  try {
    await db.delete(mesaRegistrations).where(eq(mesaRegistrations.id, id));
  } catch (error) {
    console.error('[Cloud SQL] Delete registration failed:', error);
    throw new Error('Failed to delete registration in Cloud SQL', { cause: error });
  }
}

export async function clearRegistrationsInCloudSql() {
  try {
    await db.delete(mesaRegistrations);
  } catch (error) {
    console.error('[Cloud SQL] Clear registrations failed:', error);
    throw new Error('Failed to clear registrations in Cloud SQL', { cause: error });
  }
}

// Inquiry operations
export async function addInquiryInCloudSql(inq: any) {
  try {
    await db.insert(mesaInquiries).values({
      id: inq.id,
      name: inq.name,
      email: inq.email,
      phone: inq.phone || '',
      subject: inq.subject || '',
      message: inq.message,
      date: inq.date || ''
    }).onConflictDoNothing();
  } catch (error) {
    console.error('[Cloud SQL] Add inquiry failed:', error);
    throw new Error('Failed to add inquiry in Cloud SQL', { cause: error });
  }
}

// Settings operations
export async function setSettingInCloudSql(key: string, value: string | null) {
  try {
    if (value === null) {
      await db.delete(mesaSettings).where(eq(mesaSettings.key, key));
    } else {
      await db.insert(mesaSettings).values({
        key,
        value,
        updatedAt: new Date()
      }).onConflictDoUpdate({
        target: mesaSettings.key,
        set: { value, updatedAt: new Date() }
      });
    }
  } catch (error) {
    console.error('[Cloud SQL] Set setting failed:', error);
    throw new Error('Failed to save setting in Cloud SQL', { cause: error });
  }
}

// Diagnostic Ping for Google Cloud SQL
export async function pingCloudSql() {
  const start = Date.now();
  if (!isCloudSqlAvailable()) {
    return {
      connected: false,
      error: 'Environment variables for Cloud SQL not detected'
    };
  }
  try {
    const memCount = await db.select({ id: mesaMembers.id }).from(mesaMembers);
    const evCount = await db.select({ id: mesaEvents.id }).from(mesaEvents);
    const regCount = await db.select({ id: mesaRegistrations.id }).from(mesaRegistrations);
    const inqCount = await db.select({ id: mesaInquiries.id }).from(mesaInquiries);
    const durationMs = Date.now() - start;

    return {
      connected: true,
      instance: 'ai-studio-4308f098',
      region: 'asia-southeast1',
      database: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
      engine: 'PostgreSQL 15',
      latencyMs: durationMs,
      tableCounts: {
        members: memCount.length,
        events: evCount.length,
        registrations: regCount.length,
        inquiries: inqCount.length
      },
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Database ping error',
      latencyMs: Date.now() - start
    };
  }
}

