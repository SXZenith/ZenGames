// Avatar list — shared between Lobby and game components
// Images must be in client/public/avatars/
export const AVATARS = [
  { id: 'penguin',    src: '/avatars/penguin.png',    label: 'Penguin'    },
  { id: 'crocodile',  src: '/avatars/crocodile.png',  label: 'Croc'       },
  { id: 'eagle',      src: '/avatars/eagle.png',      label: 'Eagle'      },
  { id: 'unicorn',    src: '/avatars/unicorn.png',    label: 'Unicorn'    },
  { id: 'tiger',      src: '/avatars/tiger.png',      label: 'Tiger'      },
  { id: 'monkey',     src: '/avatars/monkey.png',     label: 'Monkey'     },
  { id: 'frog',       src: '/avatars/frog.png',       label: 'Frog'       },
  { id: 'panda',      src: '/avatars/panda.png',      label: 'Panda'      },
];

export const DEFAULT_AVATAR = AVATARS[0];

export function getAvatar(avatarId) {
  return AVATARS.find(a => a.id === avatarId) || DEFAULT_AVATAR;
}
