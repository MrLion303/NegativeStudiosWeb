document.addEventListener('DOMContentLoaded', async () => {
  const container = document.querySelector('#projectGrid');
  if (!container) return;

  try {
    if (!window.NS_DATA || !Array.isArray(window.NS_DATA.projects)) return;
    await window.NS_PROJECT_ARTWORK_READY;

    try {
      const response = await fetch('assets/project-registry.json?v=' + Date.now(), { cache: 'no-store' });
      if (response.ok) {
        const extra = await response.json();
        if (Array.isArray(extra)) {
          const ids = new Set(window.NS_DATA.projects.map(project => project.id));
          extra.forEach(project => {
            if (project && project.id && !ids.has(project.id)) {
              window.NS_DATA.projects.push({ ...project, legacy: project.route || '', featured: false });
              ids.add(project.id);
            }
          });
        }
      }
    } catch (_) {}

    const pageRoutes = {
      overland: 'proyectos/overland/index.html',
      'proyecto-y': 'proyectos/proyecto-y/index.html',
      parasites: 'proyectos/parasites/index.html',
      'jujutsu-kaisen': 'proyectos/culling-games/index.html',
      'pc-rebirth': 'proyectos/pdc-rebirth/index.html',
      'negative-awards': 'proyectos/negative-awards/index.html',
      'negativemc-ep3': 'proyectos/negativemc-episodio-3/index.html',
      'proyecto-x': 'proyectos/proyecto-x/index.html',
      permamuerte: 'proyectos/permamuerte/index.html',
      'pdc-final-chapter': 'proyectos/pdc-final-chapter/index.html'
    };

    const phaseOrder = ['Fase 1', 'Fase 2', 'Fase 3', 'No canon'];
    const orderedIds = {
      'Fase 1': ['negativemc', 'negativemc-2', 'proyecto-x', 'negativemc-ep3', 'pc-rebirth', 'proyecto-y'],
      'Fase 2': ['overland', 'parasites'],
      'Fase 3': ['caos-games']
    };
    const projects = window.NS_DATA.projects.filter(project => project && project.id);
    const projectById = new Map(projects.map(project => [project.id, project]));
    const used = new Set();
    const grouped = new Map(phaseOrder.map(phase => [phase, []]));

    for (const phase of phaseOrder.slice(0, 3)) {
      for (const id of orderedIds[phase]) {
        const project = projectById.get(id);
        if (project && !used.has(id)) {
          grouped.get(phase).push(project);
          used.add(id);
        }
      }
    }
    grouped.set('No canon', projects.filter(project => !used.has(project.id)));

    container.replaceChildren();
    let index = 0;

    phaseOrder.forEach(phase => {
      const items = grouped.get(phase);
      if (!items.length) return;

      const section = document.createElement('section');
      section.className = 'project-phase-section';
      section.dataset.phaseSection = phase;

      const heading = document.createElement('div');
      heading.className = 'section-head project-phase-heading';

      const headingCopy = document.createElement('div');
      const eyebrow = document.createElement('span');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = phase === 'No canon' ? 'Fuera de las fases oficiales' : 'Clasificación de proyectos';
      const title = document.createElement('h2');
      title.className = 'title';
      title.style.cssText = 'margin-top:12px;font-size:clamp(1.7rem,3vw,2.7rem)';
      title.textContent = phase;
      headingCopy.append(eyebrow, title);
      heading.appendChild(headingCopy);

      const cardGrid = document.createElement('div');
      cardGrid.className = 'grid-3 project-phase-grid';

      items.forEach(project => {
        const artwork = window.NS_PROJECT_ARTWORK?.[project.id] || project.artwork || '';
        const original = window.NS_ORIGINAL_CONTENT?.[project.id];
        const link = document.createElement('a');
        link.className = 'card project-card reveal';
        link.href = pageRoutes[project.id] || project.route || `proyecto.html?id=${encodeURIComponent(project.id)}`;
        link.dataset.phase = phase;
        link.dataset.status = project.status || '';
        link.dataset.projectId = project.id;
        link.dataset.editorSelectable = 'project-card';

        const media = document.createElement('div');
        media.className = 'card-media' + (artwork ? ' has-image' : '');
        if (artwork) {
          const image = document.createElement('img');
          image.className = 'card-media-img';
          image.src = artwork;
          image.alt = 'Portada de ' + (project.name || 'proyecto');
          image.dataset.nsProjectImage = project.id;
          image.loading = 'lazy';
          image.onerror = () => { image.style.display = 'none'; };
          media.appendChild(image);
        }

        const number = document.createElement('span');
        number.className = 'card-index';
        number.textContent = String(++index).padStart(2, '0');
        media.appendChild(number);

        const body = document.createElement('div');
        body.className = 'card-body';

        const status = document.createElement('span');
        status.className = 'pill' + (/próx|activo|desarrollo|anunciado/i.test(project.status || '') ? ' upcoming' : '');
        status.textContent = project.status || '';

        const name = document.createElement('h3');
        name.style.marginTop = '14px';
        name.textContent = project.name || 'Proyecto';

        const description = document.createElement('p');
        description.textContent = original?.summary || project.summary || '';

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const type = document.createElement('span');
        type.textContent = phase + ' · ' + (project.type || 'Proyecto');
        const year = document.createElement('span');
        year.textContent = (project.year || '') + ' ↗';
        meta.append(type, year);

        body.append(status, name, description, meta);
        link.append(media, body);
        cardGrid.appendChild(link);
      });

      section.append(heading, cardGrid);
      container.appendChild(section);
    });

    const countLabel = document.querySelector('[data-project-count]');
    if (countLabel) countLabel.textContent = `Archivo completo · ${index} proyectos`;

    container.querySelectorAll('.reveal').forEach(card => card.classList.add('in'));
    window.NSApplyProjectArtwork?.(document);
    document.dispatchEvent(new Event('projects-rendered'));
  } catch (error) {
    console.error('NegativeStudios projects:', error);
  }
});
