export interface GalleryPhoto { src: string; caption: string }

/** Marketing renders for a project, shown in its photo gallery. Keyed by project code; only 41 ZOY+ has photos so far. */
export const PROJECT_GALLERIES: Record<string, GalleryPhoto[]> = {
  'PRJ-41ZOY-PLUS': [
    { src: '/projects/zoy/01.jpg', caption: 'Aerial view of the project' },
    { src: '/projects/zoy/10.jpg', caption: 'The tower at dusk' },
    { src: '/projects/zoy/03.jpg', caption: 'The tower from above, at night' },
    { src: '/projects/zoy/09.jpg', caption: 'Entrance and ground-floor shops' },
    { src: '/projects/zoy/07.jpg', caption: 'Site plan from above' },
    { src: '/projects/zoy/05.jpg', caption: 'Pool deck' },
    { src: '/projects/zoy/04.jpg', caption: 'Podium garden and play area' },
    { src: '/projects/zoy/06.jpg', caption: 'Sports court and play lawn' },
    { src: '/projects/zoy/02.jpg', caption: 'Lawn and temple' },
  ],
};
