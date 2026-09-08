import { useEffect, useRef, useState } from 'react';
import { FaCamera, FaCheck, FaEdit, FaEnvelope, FaGraduationCap, FaPhone, FaShieldAlt } from 'react-icons/fa';
import { apiAssetUrl } from '../utils/courseApi';
import { PROFILE_FIELDS, profileChecklist, profileDraft, profileInitials, profileSummary, validateProfile, validateProfilePhoto } from '../utils/tutorProfile';
import '../styles/TutorProfile.css';

export function TutorAvatar({ name, src }) {
  const [failedSource, setFailedSource] = useState(null);
  return <div className="tp-avatar">
    {src && failedSource !== src
      ? <img src={apiAssetUrl(src)} alt={`${name || 'Tutor'} profile`} onError={() => setFailedSource(src)} />
      : <span role="img" aria-label={`${name || 'Tutor'} initials`}>{profileInitials(name)}</span>}
  </div>;
}

function ProfileSection({ title, value, prompt, field, edit, children }) {
  return <section className="tp-section">
    <div className="tp-section-heading"><h2>{title}</h2><button type="button" onClick={() => edit(field)} aria-label={`Edit ${title.toLowerCase()}`}><FaEdit aria-hidden="true" /></button></div>
    {value?.trim() ? children || <p className="tp-prose">{value}</p> : <div className="tp-empty"><p>{prompt}</p><button type="button" onClick={() => edit(field)}>Add {title.toLowerCase()}</button></div>}
  </section>;
}

export function TutorProfileEditor({ data, save, cancel, saved, initialField = 'name' }) {
  const [form, setForm] = useState(() => profileDraft(data));
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);
  const request = useRef(false);
  useEffect(() => { formRef.current?.elements.namedItem(initialField)?.focus(); }, [initialField]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const change = (key, value) => {
    setForm(current => key === 'name' ? { ...current, name: value } : { ...current, tutorProfile: { ...current.tutorProfile, [key]: value } });
    setErrors(current => ({ ...current, [key]: '' }));
  };
  const selectPhoto = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const error = validateProfilePhoto(file);
    setErrors(current => ({ ...current, photo: error }));
    if (!error) { setPhoto(file); setPreview(URL.createObjectURL(file)); }
    event.target.value = '';
  };
  const submit = async event => {
    event.preventDefault();
    if (request.current) return;
    const validation = validateProfile(form);
    if (errors.photo) validation.photo = errors.photo;
    setErrors(validation);
    setApiError('');
    if (Object.keys(validation).length) {
      formRef.current?.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }
    request.current = true;
    setSaving(true);
    try {
      await save(form, photo);
      saved();
    } catch (error) {
      setApiError(error.message || 'Unable to save your profile. Please try again.');
    } finally {
      request.current = false;
      setSaving(false);
    }
  };
  const field = (key, label, { multiline = false, help = '', maxLength } = {}) => {
    const Input = multiline ? 'textarea' : 'input';
    return <label className="tp-field" key={key}>
      <span>{label}{key === 'name' ? ' *' : ''}</span>
      <Input name={key} value={key === 'name' ? form.name : form.tutorProfile[key]} onChange={event => change(key, event.target.value)} maxLength={maxLength || PROFILE_FIELDS.find(([name]) => name === key)?.[2]} rows={key === 'bio' ? 5 : 3} type={key === 'phoneNumber' ? 'tel' : 'text'} autoComplete={key === 'name' ? 'name' : key === 'phoneNumber' ? 'tel' : 'off'} aria-required={key === 'name'} aria-invalid={Boolean(errors[key])} aria-describedby={`tp-${key}-help${errors[key] ? ` tp-${key}-error` : ''}`} />
      <small id={`tp-${key}-help`}>{help}</small>
      {errors[key] && <small className="tp-field-error" id={`tp-${key}-error`}>{errors[key]}</small>}
    </label>;
  };
  return <form ref={formRef} className="tp-editor" onSubmit={submit} noValidate aria-busy={saving}>
    <header><span className="tp-eyebrow">PROFILE EDITOR</span><h2>Edit your profile</h2><p>Keep your teaching background and contact details up to date. * Required field.</p></header>
    {apiError && <div className="tp-error" role="alert">{apiError} Your changes are still here; try saving again.</div>}
    {Object.values(errors).some(Boolean) && <p className="tp-error" role="alert">Review the highlighted fields before saving.</p>}
    <fieldset disabled={saving}><legend>Basic information</legend><div className="tp-form-grid">
      {field('name', 'Full name', { maxLength: 120, help: 'Use the name your students know you by. Up to 120 characters.' })}
      <label className="tp-field"><span>Email address</span><input name="email" value={form.email} readOnly type="email" /><small>Your sign-in email cannot be changed here.</small></label>
      {field('phoneNumber', 'Phone number', { help: 'Optional. Include your country code, for example +66 81 234 5678.' })}
    </div></fieldset>
    <fieldset disabled={saving}><legend>Professional information</legend><div className="tp-form-grid">
      {field('expertise', 'Subject / Expertise', { help: 'Separate subjects with commas. Up to 500 characters.' })}
      {field('education', 'Education', { multiline: true, help: 'Qualifications, institutions and areas of study. Up to 2,000 characters.' })}
      {field('teachingExperience', 'Teaching experience', { multiline: true, help: 'Describe your teaching roles and experience. Up to 2,000 characters.' })}
    </div></fieldset>
    <fieldset disabled={saving}><legend>Biography</legend>{field('bio', 'About you', { multiline: true, help: 'A short introduction to your background and teaching approach. Up to 3,000 characters.' })}</fieldset>
    <fieldset disabled={saving}><legend>Profile image</legend><div className="tp-photo-editor"><TutorAvatar name={form.name} src={preview || data.tutorProfile?.photoUrl} /><div><label className="tp-field"><span>Choose a profile photo</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} aria-invalid={Boolean(errors.photo)} aria-describedby="tp-photo-help" /></label><p id="tp-photo-help">JPEG, PNG or WebP · Maximum 5 MB. A centered portrait works best.</p>{photo && <p className="tp-photo-selection">{photo.name} · Preview only until you save</p>}{errors.photo && <p className="tp-field-error">{errors.photo}</p>}</div></div></fieldset>
    <footer><span role="status">{saving ? 'Saving your profile…' : 'Changes are saved only when you choose Save profile.'}</span><button type="button" onClick={cancel} disabled={saving}>Cancel</button><button className="tp-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></footer>
  </form>;
}

export default function TutorProfile({ data, courses, overview, save }) {
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const editButton = useRef(null);
  const finish = success => {
    setEditing(null);
    setNotice(success ? 'Your profile has been updated.' : '');
    window.requestAnimationFrame(() => editButton.current?.focus());
  };
  if (!data) return <div className="tp-error" role="alert">Your profile could not be loaded. Please try opening the dashboard again.</div>;
  const profile = data.tutorProfile || {};
  const checklist = profileChecklist(data);
  const complete = checklist.filter(item => item.complete).length;
  const completion = Math.round(complete / checklist.length * 100);
  const stats = profileSummary(courses, overview);
  const expertise = profile.expertise?.split(/[,;\n]+/).map(subject => subject.trim()).filter(Boolean) || [];
  const edit = field => { setNotice(''); setEditing(field); };
  return <div className="tp-page">
    {notice && <p className="tp-success" role="status"><FaCheck aria-hidden="true" />{notice}</p>}
    {editing !== null ? <TutorProfileEditor data={data} initialField={editing} save={save} cancel={() => finish(false)} saved={() => finish(true)} /> : <>
      <section className="tp-identity" aria-label="Tutor profile summary">
        <div className="tp-avatar-wrap"><TutorAvatar name={data.name} src={profile.photoUrl} /><button type="button" className="tp-photo-action" onClick={() => edit('photo')} aria-label="Edit profile photo"><FaCamera aria-hidden="true" /></button></div>
        <div className="tp-identity-copy"><div className="tp-badges">{data.role && <span>{data.role}</span>}{data.accountStatus && <span className="tp-account-status"><FaShieldAlt aria-hidden="true" />{data.accountStatus}</span>}</div><h2>{data.name}</h2><p className="tp-subject">{expertise[0] || 'Your teaching profile'}</p><p className="tp-email">{data.email}</p></div>
        <div className="tp-identity-actions"><button ref={editButton} type="button" className="tp-primary" onClick={() => edit('name')}><FaEdit aria-hidden="true" />Edit profile</button><div className="tp-completion"><span>Profile completeness <strong>{completion}%</strong></span><progress value={complete} max={checklist.length} aria-label="Profile completeness" /></div></div>
      </section>
      {stats.length > 0 && <section className="tp-stats" aria-label="Teaching summary">{stats.map(([label, value]) => <div key={label}><strong>{value.toLocaleString()}</strong><span>{label}</span></div>)}</section>}
      <div className="tp-columns"><div className="tp-main-column">
        <ProfileSection title="About" value={profile.bio} prompt="Add a short introduction for your students." field="bio" edit={edit} />
        <ProfileSection title="Expertise" value={profile.expertise} prompt="Share the subjects you teach." field="expertise" edit={edit}><ul className="tp-tags">{expertise.map((subject, index) => <li key={`${subject}-${index}`}>{subject}</li>)}</ul></ProfileSection>
        <div className="tp-background"><ProfileSection title="Education" value={profile.education} prompt="Add your education background." field="education" edit={edit} /><ProfileSection title="Teaching experience" value={profile.teachingExperience} prompt="Describe your teaching experience." field="teachingExperience" edit={edit} /></div>
      </div><aside className="tp-side-column">
        <section className="tp-section"><h2>Contact & account</h2><dl className="tp-contact"><div><dt><FaEnvelope aria-hidden="true" />Email address</dt><dd>{data.email}</dd></div><div><dt><FaPhone aria-hidden="true" />Phone number</dt><dd>{profile.phoneNumber || <button type="button" onClick={() => edit('phoneNumber')}>Add a contact number</button>}</dd></div>{data.role && <div><dt><FaGraduationCap aria-hidden="true" />Account role</dt><dd className="tp-capitalize">{data.role}{data.accountStatus ? ` · ${data.accountStatus}` : ''}</dd></div>}</dl><p className="tp-private-note"><FaShieldAlt aria-hidden="true" />Private dashboard account details</p></section>
        <section className="tp-section tp-checklist"><h2>Make your profile complete</h2><p>{complete} of {checklist.length} details added</p><ul>{checklist.map(item => <li key={item.key}><span className={item.complete ? 'tp-check done' : 'tp-check'} aria-label={item.complete ? 'Complete' : 'Missing'}>{item.complete && <FaCheck aria-hidden="true" />}</span>{item.complete ? <span>{item.label}</span> : <button type="button" onClick={() => edit(item.key)}>{item.label}<span aria-hidden="true"> +</span></button>}</li>)}</ul><button type="button" className="tp-quick-edit" onClick={() => edit(checklist.find(item => !item.complete)?.key || 'name')}>Update profile details <span aria-hidden="true">→</span></button></section>
      </aside></div>
    </>}
  </div>;
}
