import * as migration_20261004_002942_initial from './20261004_002942_initial';
import * as migration_20261004_021630_journal from './20261004_021630_journal';
import * as migration_20261004_021657_journal_cleanup from './20261004_021657_journal_cleanup';
import * as migration_20261004_081129_habits from './20261004_081129_habits';
import * as migration_20261004_081233_habits_cleanup from './20261004_081233_habits_cleanup';
import * as migration_20261004_081253_week_theme_cleanup from './20261004_081253_week_theme_cleanup';
import * as migration_20261004_083930_notebooks from './20261004_083930_notebooks';
import * as migration_20261004_112651_notebooks_v2 from './20261004_112651_notebooks_v2';
import * as migration_20261004_112659_day_plan_cleanup from './20261004_112659_day_plan_cleanup';
import * as migration_20261005_152851_task_migrated_from_unique from './20261005_152851_task_migrated_from_unique';
import * as migration_20261005_153425_page_options from './20261005_153425_page_options';
import * as migration_20261007_082125_ux_batch from './20261007_082125_ux_batch';
import * as migration_20261009_054732_books from './20261009_054732_books';

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
    name: '20261004_021657_journal_cleanup',
  },
  {
    up: migration_20261004_081129_habits.up,
    down: migration_20261004_081129_habits.down,
    name: '20261004_081129_habits',
  },
  {
    up: migration_20261004_081233_habits_cleanup.up,
    down: migration_20261004_081233_habits_cleanup.down,
    name: '20261004_081233_habits_cleanup',
  },
  {
    up: migration_20261004_081253_week_theme_cleanup.up,
    down: migration_20261004_081253_week_theme_cleanup.down,
    name: '20261004_081253_week_theme_cleanup',
  },
  {
    up: migration_20261004_083930_notebooks.up,
    down: migration_20261004_083930_notebooks.down,
    name: '20261004_083930_notebooks',
  },
  {
    up: migration_20261004_112651_notebooks_v2.up,
    down: migration_20261004_112651_notebooks_v2.down,
    name: '20261004_112651_notebooks_v2',
  },
  {
    up: migration_20261004_112659_day_plan_cleanup.up,
    down: migration_20261004_112659_day_plan_cleanup.down,
    name: '20261004_112659_day_plan_cleanup',
  },
  {
    up: migration_20261005_152851_task_migrated_from_unique.up,
    down: migration_20261005_152851_task_migrated_from_unique.down,
    name: '20261005_152851_task_migrated_from_unique',
  },
  {
    up: migration_20261005_153425_page_options.up,
    down: migration_20261005_153425_page_options.down,
    name: '20261005_153425_page_options',
  },
  {
    up: migration_20261007_082125_ux_batch.up,
    down: migration_20261007_082125_ux_batch.down,
    name: '20261007_082125_ux_batch',
  },
  {
    up: migration_20261009_054732_books.up,
    down: migration_20261009_054732_books.down,
    name: '20261009_054732_books'
  },
];
