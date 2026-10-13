// =========================================================
// FLOW DEFINITIONS
//
// Field `name` values must exactly match the field-name keys the backend's
// FIELD_MAP expects (see the Supabase Edge Function `submit-signup`) —
// that function translates these human-readable names into the actual
// Postgres columns, per role:
//   seeker      -> seekers table       (no vetting)
//   assistant   -> assistants table    (no vetting)
//   mother      -> mothers table       (vetted)
//   priest      -> pastors table       (vetted)
//   influencer  -> influencers table   (vetted)
//   church      -> churches table      (auto-approved; contact + reference
//                  details go to the owner-only church_private table)
//
// Every role's table has a referral_number column, drawn from one shared
// sequence across all five tables — so every sign-up, regardless of role,
// gets a unique referral code back (e.g. "RT-00042") shown on their
// thank-you screen.
// =========================================================

export const SUPPORT_OPTIONS = [
  'Grief',
  'Addiction & Recovery',
  'Family Estrangement',
  'Marriage',
  'Parenting',
  'Kids',
  'Isolation & Loneliness',
  'Anger',
  'Other',
];


export const COMMUNITY_SIZE_OPTIONS = [
  '20,000–50,000',
  '50,000–100,000',
  '100,000–500,000',
  '500,000+',
];

export const CHURCH_TYPE_OPTIONS = ['Church', 'Ministry', 'Parachurch / non-profit', 'Fellowship / small group', 'Other'];
export const CHURCH_SIZE_OPTIONS = ['Under 50', '50–150', '150–500', '500–2,000', '2,000+'];
export const CHURCH_FOCUS_OPTIONS = [
  'Prayer', 'Teaching & discipleship', 'Worship', 'Youth & young adults', 'Women', 'Men', 'Marriage & family',
  'Counselling & care', 'Outreach & missions', 'Recovery & healing', 'Online ministry', 'Other',
];
export const CHURCH_MEETING_OPTIONS = ['In person', 'Online', 'Both in person and online'];
export const CHURCH_REGISTRATION_OPTIONS = [
  'Registered charity / non-profit', 'Incorporated church or ministry', 'Part of a denomination or network', 'Not formally registered',
];

export const HIGHER_ED_OPTIONS = ['Yes, I do', "No, I don't"];

export const EDUCATION_OPTIONS = [
  "Bachelor's Degree",
  "Master's Degree",
  'Doctorate (PhD / PsyD)',
  'Certificate / Diploma',
  'Ministry / Seminary Training',
  'Other',
];

export const LICENSE_OPTIONS = [
  'Licensed Marriage & Family Therapist (LMFT)',
  'Licensed Clinical Social Worker (LCSW)',
  'Licensed Professional Counselor (LPC)',
  'Licensed Mental Health Counselor (LMHC)',
  'Licensed Psychologist (PhD / PsyD)',
  'Certified Addiction Counselor',
  'Certified Life Coach',
  'Board-Certified Chaplain',
  'None yet — in progress',
];

export const SPECIALTY_OPTIONS = [
  'Family Constellation Therapy',
  'Cognitive Behavioral Therapy (CBT)',
  'EMDR',
  'Somatic / Body-Based Therapy',
  'Trauma-Informed Care',
  'Grief & Bereavement',
  'Addiction & Recovery',
  'Marriage & Couples Counseling',
  'Family Systems Therapy',
  'Child & Adolescent Counseling',
  'Anger Management',
  'Anxiety & Depression',
  'Faith-Based / Christian Counseling',
  'Pastoral Care & Spiritual Direction',
  'Life Coaching',
];

// Shared by every vetted professional role (Spiritual Mother, Priest/Pastor,
// Spiritual Leader — see NEEDS_VETTING_ROLES in the submit-signup Edge
// Function). Gates whether the credentials step below is shown: "No"
// submits straight through with nothing further asked; "Yes" continues
// into education/license/specialty + a certification upload.
const CREDENTIALS_GATE_FIELD = {
  name: 'Has Relevant Credentials',
  label: 'Do you have a relevant degree, license, or certification?',
  type: 'pillselect',
  options: HIGHER_ED_OPTIONS,
  required: true,
  hint: 'This decides what happens after Continue — say yes and we’ll ask about your background next.',
};

// Shared credentials step for the three vetted professional roles above —
// only shown once CREDENTIALS_GATE_FIELD is answered "Yes, I do" (see its
// `condition`). "Certification Upload" never appears in the Edge
// Function's FIELD_MAP — same treatment as Password/Profile Picture, it
// travels as its own `certificationFile` payload key (see App.js submit()).
function credentialsStep(idPrefix) {
  return {
    id: `${idPrefix}-credentials`,
    title: 'Your background & expertise',
    sub: 'This helps us verify your credentials and match you with the right seekers. You can add more later from your profile.',
    condition: (d) => d['Has Relevant Credentials'] === 'Yes, I do',
    fields: [
      { name: 'Highest Level of Education', label: 'Highest level of education', type: 'pillselect', options: EDUCATION_OPTIONS, hint: 'Select one', required: true },
      { name: 'Licenses & Certifications', label: 'Licenses & certifications', type: 'pillmultiselect', options: LICENSE_OPTIONS, hint: 'Select all that apply' },
      { name: 'Areas of Specialty', label: 'Areas of specialty', type: 'pillmultiselect', options: SPECIALTY_OPTIONS, hint: 'Select all that apply' },
      { name: 'Certification Upload', label: 'Upload your certification', type: 'file', hint: 'PDF, JPG or PNG. Used to verify your credentials before you’re approved — not shown publicly on your profile.' },
    ],
  };
}

// Shared by every role's "extra" step, added last so identity fields
// (name/email/DOB) stay first everywhere.
const SOCIAL_FIELDS = [
  { name: 'Instagram', label: 'Instagram handle (optional)', type: 'text', hint: 'e.g. @yourname — helps us get a feel for who you are.' },
  { name: 'Profile Picture', label: 'Profile picture (optional)', type: 'image' },
];

// Every role's first step ends with these two — creating a real login is
// now part of signing up, not a separate step later. They deliberately
// never appear in the Edge Function's FIELD_MAP: `App.js` pulls
// "Password" out of `fields` and sends it as its own `password` payload
// key instead (same treatment as the profile picture), and "Confirm
// Password" never leaves the device at all — it only exists to catch a
// typo before submitting.
const ACCOUNT_FIELDS = [
  { name: 'Password', label: 'Create a password', type: 'password', required: true, hint: 'At least 8 characters.' },
  { name: 'Confirm Password', label: 'Confirm password', type: 'password', required: true },
];

export const FLOWS = {
  seeker: {
    label: 'Spiritual Seeker',
    intro: 'Grow in your faith with guidance, community, and support along the way.',
    steps: [
      {
        id: 'seeker-core',
        title: 'Tell us a little about you',
        sub: 'Just the basics for now — takes under a minute.',
        fields: [
          { name: 'Name', label: 'Full name', type: 'text', required: true },
          { name: 'Nickname', label: 'Nickname (optional)', type: 'text' },
          { name: 'Preferred Display', label: 'What should we call you?', type: 'select', options: ['Name', 'Nickname'] },
          { name: 'Email', label: 'Email', type: 'email', required: true },
          ...ACCOUNT_FIELDS,
          { name: 'Date of Birth', label: 'Date of birth', type: 'date', required: true },
          { name: 'Signing Up For', label: 'Who are you signing up for?', type: 'select', options: ['Myself', 'My child'], required: true },
          {
            name: 'Child Age',
            label: 'Child’s age',
            type: 'number',
            required: true,
            hint: 'In years.',
            condition: (d) => d['Signing Up For'] === 'My child',
          },
          { name: 'Religion', label: 'Do you identify as Christian?', type: 'select', options: ['Christian', 'Other'], required: true },
        ],
      },
      {
        id: 'seeker-faith',
        title: 'Help us find the right fit',
        sub: 'Everything below is optional — it just helps us match you with the right Spiritual Mother.',
        condition: (d) => d.Religion === 'Christian',
        fields: [
          { name: 'What Kind of Support Are You Looking For', label: 'What kind of support are you looking for?', type: 'multiselect', options: SUPPORT_OPTIONS },
          { name: 'Faith Background', label: 'Faith background', type: 'select', options: ['Catholic', 'Protestant / Evangelical', 'Orthodox', 'Non-denominational', 'Still exploring faith', 'Other'] },
          { name: 'Your Story', label: 'A few words about where you’re at (optional)', type: 'textarea' },
          { name: 'Country', label: 'Country / general location', type: 'text' },
          ...SOCIAL_FIELDS,
        ],
        safetyNote: true,
      },
    ],
  },
  assistant: {
    label: 'Spiritual Assistant',
    intro: 'Serve alongside a Spiritual Mother.',
    steps: [
      {
        id: 'assistant-core',
        title: 'I want to be a Spiritual Assistant',
        sub: 'Assisting a Spiritual Mother is a meaningful way to serve while you grow into this calling yourself.',
        fields: [
          { name: 'Name', label: 'Full name', type: 'text', required: true },
          { name: 'Email', label: 'Email', type: 'email', required: true },
          ...ACCOUNT_FIELDS,
          { name: 'Date of Birth', label: 'Date of birth', type: 'date', required: true },
        ],
      },
      {
        id: 'assistant-more',
        title: 'A bit more about you',
        sub: 'Optional, but it helps us match you to a Spiritual Mother you’d work well alongside.',
        fields: [
          { name: 'Your Story / Testimony', label: 'Your story / testimony', type: 'textarea' },
          { name: 'Spiritual Gifts & Areas of Focus', label: 'Spiritual gifts & areas of focus', type: 'multiselect', options: SUPPORT_OPTIONS },
          { name: 'Years of Experience', label: 'Years of experience', type: 'select', options: ['New to this', '1–2 years', '3–5 years', '5+ years'] },
          { name: 'Faith Tradition / Church', label: 'Faith tradition / church', type: 'text' },
          { name: 'Church or Pastoral Reference', label: 'Church or pastoral reference (optional)', type: 'text', hint: 'Name + contact — for our own vetting, never shown publicly.' },
          { name: 'Anything Else', label: 'Anything else? (optional)', type: 'textarea' },
          ...SOCIAL_FIELDS,
        ],
      },
    ],
  },
  mother: {
    label: 'Spiritual Mother',
    intro: 'Lead and shape a spiritual family of your own.',
    steps: [
      {
        id: 'mother-core',
        title: 'I want to be a Spiritual Mother',
        sub: 'If you sense a call to walk alongside others, we’d love to know you’re interested before applications open.',
        fields: [
          { name: 'Name', label: 'Full name', type: 'text', required: true },
          { name: 'Email', label: 'Email', type: 'email', required: true },
          ...ACCOUNT_FIELDS,
          { name: 'Date of Birth', label: 'Date of birth', type: 'date', required: true },
        ],
      },
      {
        id: 'mother-more',
        title: 'A bit more about you',
        sub: 'Optional, but it helps us match you to a family you’d be a great fit for.',
        fields: [
          { name: 'Your Story / Testimony', label: 'Your story / testimony', type: 'textarea' },
          { name: 'Spiritual Gifts & Areas of Focus', label: 'Spiritual gifts & areas of focus', type: 'multiselect', options: SUPPORT_OPTIONS },
          { name: 'Years of Experience', label: 'Years of experience', type: 'select', options: ['New to this', '1–2 years', '3–5 years', '5+ years'] },
          { name: 'Faith Tradition / Church', label: 'Faith tradition / church', type: 'text' },
          { name: 'Capacity (How Many People)', label: 'Capacity (how many people)', type: 'select', options: ['1–2', '3–4', '5–6 (a full family)', 'Not sure yet'] },
          { name: 'Assistant Preference', label: 'Would you like a Spiritual Assistant to help you, or would you prefer to work alone?', type: 'select', options: ["I'd welcome a Spiritual Assistant", 'I prefer to work alone'] },
          { name: 'Church or Pastoral Reference', label: 'Church or pastoral reference (optional)', type: 'text', hint: 'Name + contact — for our own vetting, never shown publicly.' },
          { name: 'Anything Else', label: 'Anything else? (optional)', type: 'textarea' },
          CREDENTIALS_GATE_FIELD,
          ...SOCIAL_FIELDS,
        ],
      },
      credentialsStep('mother'),
    ],
  },
  priest: {
    label: 'Priest / Pastor',
    intro: 'Partner your church with Rooted Together.',
    steps: [
      {
        id: 'priest-core',
        title: 'Partner with Rooted Together',
        sub: 'A few basics to start.',
        fields: [
          { name: 'Name', label: 'Full name', type: 'text', required: true },
          { name: 'Email', label: 'Email', type: 'email', required: true },
          ...ACCOUNT_FIELDS,
          { name: 'Date of Birth', label: 'Date of birth', type: 'date', required: true },
          { name: 'Church / Parish Name', label: 'Church / parish name', type: 'text', required: true },
          { name: 'Denomination', label: 'Denomination', type: 'text', required: true },
        ],
      },
      {
        id: 'priest-more',
        title: 'A bit more about your ministry',
        sub: 'Optional, but it helps us get to know you and your ministry better.',
        fields: [
          { name: 'Your Story / Testimony', label: 'Your testimony', type: 'textarea' },
          { name: 'Years in Ministry', label: 'Years in ministry (years of experience)', type: 'select', options: ['New to ministry', '1–5 years', '5–15 years', '15+ years'] },
          { name: 'Church Location', label: 'Church location', type: 'text' },
          { name: 'Anything Else', label: 'Anything else? (optional)', type: 'textarea' },
          CREDENTIALS_GATE_FIELD,
          ...SOCIAL_FIELDS,
        ],
      },
      credentialsStep('priest'),
    ],
  },
  influencer: {
    label: 'Spiritual Leader',
    intro: 'Highly recognized influencers in spiritual and faith communities.',
    steps: [
      {
        id: 'influencer-core',
        title: "I'm a Spiritual Leader",
        sub: 'For recognized voices in spiritual and faith spaces who want to partner with Rooted Together.',
        fields: [
          { name: 'Name', label: 'Full name', type: 'text', required: true },
          { name: 'Email', label: 'Email', type: 'email', required: true },
          ...ACCOUNT_FIELDS,
          { name: 'Date of Birth', label: 'Date of birth', type: 'date', required: true },
        ],
      },
      {
        id: 'influencer-more',
        title: 'Your platform',
        sub: 'This helps us understand your reach before we follow up.',
        fields: [
          { name: 'Instagram', label: 'Instagram handle', type: 'text', required: true, hint: 'e.g. @yourname' },
          { name: 'Approximate Following / Community Size', label: 'Approximate following / community size', type: 'select', options: COMMUNITY_SIZE_OPTIONS, required: true },
          { name: 'Anything Else', label: 'Anything else? (optional)', type: 'textarea' },
          CREDENTIALS_GATE_FIELD,
          { name: 'Profile Picture', label: 'Profile picture (optional)', type: 'image' },
        ],
      },
      credentialsStep('influencer'),
    ],
  },
  church: {
    label: 'Church / Ministry',
    intro: 'Give your church or ministry a home: share your community, teaching and offerings.',
    steps: [
      {
        id: 'church-core',
        title: 'Register your church or ministry',
        sub: 'The essentials to get you started. Your organisation goes live as soon as you finish sign-up.',
        fields: [
          { name: 'Organisation Name', label: 'Church or ministry name', type: 'text', required: true },
          { name: 'Organisation Type', label: 'Type of organisation', type: 'select', options: CHURCH_TYPE_OPTIONS, required: true },
          { name: 'Denomination', label: 'Denomination or tradition (optional)', type: 'text', hint: 'e.g. Baptist, Pentecostal, non-denominational.' },
          { name: 'City', label: 'City', type: 'text', required: true },
          { name: 'Country', label: 'Country', type: 'text', required: true },
          { name: 'Contact Name', label: 'Your name', type: 'text', required: true, hint: 'The person signing up. Kept private, never shown publicly.' },
          { name: 'Contact Role', label: 'Your role (optional)', type: 'text', hint: 'e.g. Senior Pastor, Administrator.' },
          { name: 'Email', label: 'Email', type: 'email', required: true },
          ...ACCOUNT_FIELDS,
        ],
      },
      {
        id: 'church-more',
        title: 'About your organisation',
        sub: 'Optional, but it helps people find and trust you. You can add or change any of this later from Edit Profile.',
        fields: [
          { name: 'About / Mission', label: 'About / mission', type: 'textarea', hint: 'Who you are and who you serve.' },
          { name: 'Focus Areas', label: 'Ministries and focus areas', type: 'pillmultiselect', options: CHURCH_FOCUS_OPTIONS, hint: 'Select all that apply' },
          { name: 'Meeting Format', label: 'How do you meet?', type: 'select', options: CHURCH_MEETING_OPTIONS },
          { name: 'Congregation Size', label: 'Approximate size of your community', type: 'select', options: CHURCH_SIZE_OPTIONS },
          { name: 'Year Founded', label: 'Year founded', type: 'number', hint: 'e.g. 1998' },
          { name: 'Region / State', label: 'State / region', type: 'text' },
          { name: 'Website', label: 'Website', type: 'text', hint: 'https://' },
          ...SOCIAL_FIELDS,
        ],
      },
      {
        id: 'church-trust',
        title: 'Trust and contact details',
        sub: 'Helps people trust your organisation. Contact, reference and document details are private and never shown publicly.',
        fields: [
          { name: 'Leader Name', label: 'Lead pastor / leader name', type: 'text' },
          { name: 'Leader Title', label: 'Leader title', type: 'text', hint: 'e.g. Senior Pastor.' },
          { name: 'Registration Type', label: 'Registration status', type: 'select', options: CHURCH_REGISTRATION_OPTIONS },
          { name: 'Registration Number', label: 'Registration / charity number (optional)', type: 'text' },
          { name: 'Affiliated Body', label: 'Denominational network or association (optional)', type: 'text' },
          { name: 'Phone', label: 'Phone (optional)', type: 'text' },
          { name: 'Street Address', label: 'Street address (optional)', type: 'text' },
          { name: 'Postcode', label: 'Postcode / ZIP (optional)', type: 'text' },
          { name: 'Reference Name', label: 'Reference: name (optional)', type: 'text', hint: 'Someone outside your organisation who can vouch for it, such as a denominational leader or another pastor.' },
          { name: 'Reference Relationship', label: 'Reference: relationship to you', type: 'text' },
          { name: 'Reference Contact', label: 'Reference: email or phone', type: 'text' },
          { name: 'Certification Upload', label: 'Verification document (optional)', type: 'file', hint: 'For example a charity or incorporation certificate, or a letter from your denomination. PDF, JPG or PNG. Private, never shown publicly.' },
          { name: 'Anything Else', label: 'Anything else? (optional)', type: 'textarea' },
        ],
      },
    ],
  },
};

// Every role's thank-you screen (see ReferralThankYouScreen in App.js /
// join.html) shows this icon/title/body up top, then a personal referral
// code and an "Explore the app" button — nobody gets the old plain
// "back to start" link anymore.
export const THANK_YOU = {
  seeker_other: {
    icon: '🌱',
    title: 'Thank you.',
    body: 'We’ve noted your interest — we’ll be in touch as Rooted Together grows.',
  },
  seeker_christian: {
    icon: '🌱',
    title: 'You’re on the list.',
    body: 'We’re finding the right match for you — we will contact you.',
  },
  mother: {
    icon: '🕊️',
    title: 'Thank you for stepping forward.',
    body: 'Every Spiritual Mother goes through a vetting process before being matched with a family. We’ll follow up once that review is complete.',
  },
  assistant: {
    icon: '🌿',
    title: 'Thank you for stepping forward.',
    body: 'We’re finding the right match for you — we will contact you.',
  },
  priest: {
    icon: '🕊️',
    title: 'Thank you.',
    body: 'Every Priest/Pastor partner goes through a vetting process before being confirmed. We’ll follow up once that review is complete.',
  },
  influencer: {
    icon: '✨',
    title: 'Thank you.',
    body: 'You’re being vetted — every Spiritual Leader partner goes through a review before we confirm the partnership. We’ll follow up soon.',
  },
  church: {
    icon: '⛪',
    title: 'Welcome to Rooted Together.',
    body: 'Your church or ministry is live. Add more about your organisation any time from Profile → Edit Profile.',
  },
};
