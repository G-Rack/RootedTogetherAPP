// "Finish your profile" checklist — drives the card on the Explore tab and
// the Profile checklist screen. The short sign-up only asks the essentials,
// so everything it skips shows up here as a to-do. Every item can be filled
// in from Edit Profile (all original sign-up questions live there) or, for
// the photo, the existing photo picker.
//
// Each item reads straight off the person's own role-table row (the same
// row Edit Profile reads/writes), so ticking one off here and filling it in
// there can never disagree.
import { useCallback, useEffect, useState } from 'react';
import { fetchMyDirectoryPerson } from './postsApi';
import { fetchMyFullProfileRow } from './profileEditing';

// [key, label, row column, optional?]
const ITEMS = {
  seeker: [
    ['name', 'Name', 'name'],
    ['dob', 'Date of birth', 'date_of_birth'],
    ['support', 'What you are walking through', 'support_needs'],
    ['photo', 'Profile photo', 'profile_picture_path'],
    ['story', 'Your story', 'your_story'],
    ['country', 'Country', 'country'],
    ['instagram', 'Instagram', 'instagram', true],
    ['nickname', 'Nickname & display name', 'nickname', true],
  ],
  assistant: [
    ['name', 'Name', 'name'],
    ['dob', 'Date of birth', 'date_of_birth'],
    ['focus', 'Where you would like to serve', 'spiritual_gifts'],
    ['photo', 'Profile photo', 'profile_picture_path'],
    ['story', 'Your story', 'story_testimony'],
    ['tradition', 'Faith tradition / church', 'faith_tradition_church'],
    ['years', 'Years of experience', 'years_experience'],
    ['instagram', 'Instagram', 'instagram', true],
  ],
  mother: [
    ['name', 'Name', 'name'],
    ['dob', 'Date of birth', 'date_of_birth'],
    ['focus', 'Gifts & areas of focus', 'spiritual_gifts'],
    ['photo', 'Profile photo', 'profile_picture_path'],
    ['story', 'Your story', 'story_testimony'],
    ['tradition', 'Faith tradition / church', 'faith_tradition_church'],
    ['years', 'Years of experience', 'years_experience'],
    ['instagram', 'Instagram', 'instagram', true],
  ],
  pastor: [
    ['name', 'Name', 'name'],
    ['dob', 'Date of birth', 'date_of_birth'],
    ['church', 'Church / parish name', 'church_parish_name'],
    ['denomination', 'Denomination', 'denomination'],
    ['photo', 'Profile photo', 'profile_picture_path'],
    ['story', 'Your testimony', 'story_testimony'],
    ['years', 'Years in ministry', 'years_in_ministry'],
    ['location', 'Church location', 'church_location'],
    ['instagram', 'Instagram', 'instagram', true],
  ],
  influencer: [
    ['name', 'Name', 'name'],
    ['dob', 'Date of birth', 'date_of_birth'],
    ['photo', 'Profile photo', 'profile_picture_path'],
    ['instagram', 'Instagram', 'instagram'],
    ['community', 'Community size', 'community_size'],
  ],
  church: [
    ['name', 'Church or ministry name', 'name'],
    ['contact', 'Your name (private)', 'contact_name'],
    ['photo', 'Logo', 'profile_picture_path'],
    ['about', 'About / mission', 'story_testimony'],
    ['type', 'Type of organisation', 'organisation_type'],
    ['city', 'City', 'city'],
    ['country', 'Country', 'country'],
    ['focus', 'Ministries & focus areas', 'focus_areas'],
    ['website', 'Website', 'website', true],
  ],
};

// Creator roles get one extra, uncounted block for credentials / verification.
const CREDENTIAL_ROLES = ['mother', 'pastor', 'influencer', 'church'];

function filled(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v !== null && v !== undefined && String(v).trim() !== '';
}

// role: profiles.role spelling ('pastor', not 'priest'). row: the person's own
// role-table row (may be null).
export function buildChecklist(role, row) {
  const defs = ITEMS[role] || [];
  const items = defs.map(([key, label, column, optional]) => ({
    key,
    label,
    optional: !!optional,
    done: !!row && filled(row[column]),
  }));
  const done = items.filter((i) => i.done).length;
  return {
    items,
    done,
    total: items.length,
    complete: items.length > 0 && done === items.length,
    showCredentials: CREDENTIAL_ROLES.includes(role),
  };
}

// Loads the signed-in person's checklist. `reload` re-fetches (e.g. after
// they save Edit Profile or change their photo).
export function useProfileChecklist(session) {
  const myAuthId = session?.user?.id;
  const [state, setState] = useState({ loading: true, role: null, checklist: null });

  const reload = useCallback(async () => {
    if (!myAuthId) return;
    try {
      const person = await fetchMyDirectoryPerson(myAuthId);
      if (!person) {
        setState({ loading: false, role: null, checklist: null });
        return;
      }
      const row = await fetchMyFullProfileRow(myAuthId, person.role);
      setState({ loading: false, role: person.role, checklist: buildChecklist(person.role, row) });
    } catch (e) {
      // Stay quiet — the card simply doesn't show if this can't load.
      setState({ loading: false, role: null, checklist: null });
    }
  }, [myAuthId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
