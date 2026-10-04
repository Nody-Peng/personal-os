import * as migration_20261004_002942_initial from './20261004_002942_initial';
import * as migration_20261004_021630_journal from './20261004_021630_journal';
import * as migration_20261004_021657_journal_cleanup from './20261004_021657_journal_cleanup';

export const migrations = [
  {
    up: migration_20261004_002942_initial.up,
    down: migration_20261004_002942_initial.down,
    name: '20261004_002942_initial',
  },
  {
    up: migration_20261004_021630_journal.up,
    down: migration_20261004_021630_journal.down,
    name: '20261004_021630_journal',
  },
  {
    up: migration_20261004_021657_journal_cleanup.up,
    down: migration_20261004_021657_journal_cleanup.down,
    name: '20261004_021657_journal_cleanup'
  },
];
