export const PROFILE_FIELDS = [
  ['phoneNumber', 'Phone number', 30],
  ['expertise', 'Expertise', 500],
  ['education', 'Education', 2000],
  ['teachingExperience', 'Teaching experience', 2000],
  ['bio', 'Biography', 3000],
];

export function profileInitials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase() || 'T';
}

export function profileDraft(data) {
  return { name: data.name || '', email: data.email || '', tutorProfile: Object.fromEntries(PROFILE_FIELDS.map(([key]) => [key, data.tutorProfile?.[key] || ''])) };
}

export function validateProfile(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter your full name.';
  else if (form.name.trim().length > 120) errors.name = 'Use 120 characters or fewer.';
  for (const [key, label, limit] of PROFILE_FIELDS) {
    if ((form.tutorProfile[key] || '').trim().length > limit) errors[key] = `${label} must be ${limit} characters or fewer.`;
  }
  const phone = form.tutorProfile.phoneNumber.trim();
  if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) {
    errors.phoneNumber = 'Use 7–15 digits, with an optional + country code, spaces, brackets or dashes.';
  }
  return errors;
}

export function validateProfilePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG or WebP image.';
  if (file.size > 5 * 1024 * 1024) return 'Choose an image that is 5 MB or smaller.';
  if (!file.size) return 'This image is empty. Choose another file.';
  return '';
}

export function profileChecklist(data) {
  return [['name', 'Full name', data.name], ['email', 'Email address', data.email], ['photo', 'Profile photo', data.tutorProfile?.photoUrl], ...PROFILE_FIELDS.map(([key, label]) => [key, label, data.tutorProfile?.[key]])]
    .map(([key, label, value]) => ({ key, label, complete: Boolean(value?.trim()) }));
}

export function profileSummary(courses, overview) {
  const stats = [];
  if (Array.isArray(courses)) {
    stats.push(['Courses created', courses.length], ['Published courses', courses.filter(course => course.moderationStatus === 'published').length]);
  }
  if (Number.isFinite(overview?.totals?.students)) stats.push(['Students enrolled', overview.totals.students]);
  return stats;
}

export function profileFormData(form, photo) {
  const body = new FormData();
  body.append('name', form.name.trim());
  for (const [key] of PROFILE_FIELDS) body.append(key, (form.tutorProfile[key] || '').trim());
  if (photo) body.append('photo', photo);
  return body;
}
