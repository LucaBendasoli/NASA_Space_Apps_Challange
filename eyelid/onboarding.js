{
 const createTour = window.driver?.js?.driver;
 const preference = 'eyelid:onboarding:v1';
 const resumeHash = '#eyelid-tour-barnard';
 const tourButtons = [...document.querySelectorAll('[data-start-tour]')];

 if (createTour) {
  const navigation = byId('eyelid-navigation');
  let launcher, tour, tourSampleOpen = false;

  function show(page) {
   const button = navigation.querySelector('[data-page="'+page+'"]');
   if (!button.hasAttribute('aria-current')) button.click();
  }

  function closeSample() {
   if (!tourSampleOpen) return;
   if (!byId('object-panel').hidden) byId('minimize-object').click();
   tourSampleOpen = false;
  }

  const lessons = [
   {
    title: 'Explore with Barnard’s Star',
    description: 'Open a real observation, play it across dates, read its spectrum, and see where to discuss it.',
    next: 'Start tour'
   },
   {
    target: '#home-barnard', prepare: () => show('home'),
    title: 'Start with a saved field',
    description: 'Home gives you suggested observations and quick access to Saved Regions. We’ll open Barnard’s Star, a nearby star whose position changes noticeably over time.',
    next: 'Open Barnard’s Star'
   },
   {
    target: '#date-play', prepare: () => show('map'),
    title: 'Play the observation dates',
    description: 'Press the highlighted <strong>▶ Dates</strong> button to cycle through Barnard’s images in the same infrared band. Watch the star against its neighbors. Pause to inspect a frame, or use Image date to choose one.'
   },
   {
    target: '#open-poc-object', prepare: () => show('map'),
    title: 'Open Barnard’s object sheet',
    description: 'Select a source in the sky to open its sheet. The <strong>Barnard’s Star</strong> shortcut takes you directly to this star.',
    next: 'Open object sheet'
   },
   {
    target: '#spectrum',
    prepare: () => {
     show('map');
     byId('open-poc-object').click();
     tourSampleOpen = true;
    },
    title: 'Read the spectrum',
    description: 'The chart shows brightness across infrared wavelengths. Barnard’s measurements come from the SPHEREx mosaic. Below the chart, explore identification, infrared evidence, and technical details. Gaia sources and candidates use this same layout.'
   },
   {
    target: '.eyelid-home-tabs', prepare: () => show('home'),
    title: 'Discuss an observation',
    description: 'Open <strong>Community</strong> to read posts and replies. Choose <strong>Open view on map</strong> to revisit a shared observation. With a personal account, you can post, reply, or vote.'
   },
   {
    target: '#open-sky-search', prepare: () => show('map'),
    title: 'Explore the sky',
    description: 'Drag to move. Scroll or pinch to zoom. Use Search for a name or coordinates and the bookmark icon to return to a saved field.'
   },
   {
    target: '[for="image-channel"] + .control-row', prepare: () => show('map'),
    title: 'Compare infrared bands',
    description: 'Choose an infrared band to see a different wavelength. Use the SPHEREx mosaic to browse more bands or press <strong>▶ Channels</strong> to cycle through them. Image Options includes a false-color mode.'
   },
   {
    target: '#scan-view', prepare: () => show('map'),
    title: 'Find sources worth a closer look',
    description: 'Use <strong>Analyze map area</strong> to look for candidates in the current field. Gaia markers identify cataloged sources. Candidate markers highlight detections to review. Use Layers to adjust either overlay.'
   },
   {
    target: '#profile-title', prepare: () => show('profile'),
    title: 'Keep track of your work',
    description: 'Your profile collects your contributions and badges. Personal accounts can edit their profile and adjust preferences. The judges’ demo has a sample profile to explore.'
   }
  ];
  const barnardStep = 2;

  function markSeen() {
   try { localStorage.setItem(preference, 'seen'); } catch {}
  }

  function start(index = 0, button) {
   if (tour?.isActive()) return;
   launcher = button;
   const help = byId('eyelid-map-help');
   if (!help.hidden) byId('toggle-map-help').click();
   if (!byId('eyelid-sky-search').hidden) byId('open-sky-search').click();
   if (!byId('eyelid-sky-saved').hidden) byId('toggle-sky-saved').click();

   tour = createTour({
    animate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    smoothScroll: false,
    overlayColor: '#080b13',
    overlayOpacity: 0.73,
    overlayClickBehavior: 'none',
    stagePadding: 6,
    stageRadius: 12,
    popoverOffset: 14,
    popoverClass: 'eyelid-tour',
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    prevBtnText: 'Back',
    nextBtnText: 'Next',
    doneBtnText: 'Finish',
    onNextClick: () => move(tour.getActiveIndex() + 1),
    onPrevClick: () => move(tour.getActiveIndex() - 1),
    onDoneClick: () => tour.destroy(),
    onPopoverRender: ({footer, closeButton, title}) => {
     title.setAttribute('role','heading');
     title.setAttribute('aria-level','2');
     closeButton.setAttribute('aria-label', 'Close guided tour');
     const skip = document.createElement('button');
     skip.type = 'button';
     skip.className = 'eyelid-tour-skip';
     skip.textContent = 'Skip tour';
     skip.onclick = () => tour.destroy();
     footer.before(skip);
    },
    onDestroyed: () => {
     markSeen();
     if (launcher?.checkVisibility()) launcher.focus({preventScroll:true});
    },
    steps: lessons.map(({target,title,description,next}) => ({
     element: target ? () => {
      const element = document.querySelector(target);
      return element?.checkVisibility() ? element : undefined;
     } : undefined,
     popover: {title, description, nextBtnText:next}
    }))
   });
   move(index);
  }

  function move(index) {
   if (index < 0 || index >= lessons.length) {
    tour.destroy();
    return;
   }
   if (index === barnardStep && openingPoc?.key !== 'barnard') {
    const url = new URL(byId('home-barnard').href);
    url.hash = resumeHash;
    location.assign(url);
    return;
   }
   const lesson = lessons[index];
   if (lesson.target !== '#spectrum') closeSample();
   lesson.prepare?.();
   tour.drive(index);
  }

  for (const button of tourButtons) {
   button.hidden = false;
   button.addEventListener('click', () => start(0, button));
  }

  if (location.hash === resumeHash && openingPoc?.key === 'barnard') {
   history.replaceState(history.state, '', location.pathname + location.search);
   start(barnardStep);
  } else if (!openingTarget && !openingQuery.has('perfil') && !openingQuery.has('regiao')) {
   document.addEventListener('eyelid-account-changed', event => {
    if (!event.detail) return;
    try {
     if (!localStorage.getItem(preference)) start();
    } catch {}
   }, {once:true});
  }
 }
}
