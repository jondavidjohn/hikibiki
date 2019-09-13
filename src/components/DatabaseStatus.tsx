import { h, FunctionalComponent, JSX } from 'preact';

import { DatabaseVersion } from '../common';
import { DatabaseState } from '../database';
import { DB_LANGUAGES, DB_LANGUAGE_NAMES } from '../db-languages';
import { CloneableUpdateState } from '../update-state';

type Props = {
  databaseState: DatabaseState;
  databaseVersions: {
    kanjidb?: DatabaseVersion;
    bushudb?: DatabaseVersion;
  };
  updateState: CloneableUpdateState;
  onUpdate?: () => void;
  onCancel?: () => void;
  onDestroy?: () => void;
  onSetLang?: (lang: string) => void;
};

export const DatabaseStatus: FunctionalComponent<Props> = (props: Props) => {
  return (
    <div className="database-status bg-orange-200 rounded p-10 max-w-xl mx-auto text-orange-1000">
      <h2 className="text-lg tracking-tight text-center text-lg font-semibold">
        Kanji
      </h2>
      {renderBody(props)}
    </div>
  );
};

function renderBody(props: Props) {
  const { databaseState, updateState, databaseVersions } = props;
  if (databaseState === DatabaseState.Initializing) {
    return <div class="text-orange-1000">Initializing&hellip;</div>;
  }

  const buttonStyles =
    'bg-orange-100 font-semibold text-center p-10 rounded border-0 shadow-orange-default hover:bg-orange-50';
  const disabledButtonStyles =
    'bg-grey-100 text-gray-600 font-semibold text-center p-10 rounded border-0 shadow';

  switch (updateState.state) {
    case 'idle': {
      let status: string | JSX.Element;
      // TODO: We shouldn't need to check if kanjidb is available or not.
      //
      // If the databaseState is not Empty or Initializing (checked above) we
      // should be able to assume it is set, but we can't because of the way we
      // update from the worker where it first notifies us of the updated
      // database state, and then the updated database versions. We should
      // really fix the worker to notify of both things at once.
      if (databaseState === DatabaseState.Empty || !databaseVersions.kanjidb) {
        status = 'No database';
      } else {
        const { major, minor, patch } = databaseVersions.kanjidb!;
        status = (
          <div>
            <div>
              Version {major}.{minor}.{patch}.
            </div>
            {updateState.lastCheck ? (
              <div>Last check {formatDate(updateState.lastCheck)}.</div>
            ) : null}
          </div>
        );
      }

      return (
        <div>
          {renderDatabaseSummary(props)}
          <div class="status-with-button">
            <div class="italic">{status}</div>
            {renderLangSelector(props)}
            <button class={buttonStyles} onClick={props.onUpdate}>
              Check for updates
            </button>
          </div>
        </div>
      );
    }

    case 'checking':
      return (
        <div class="status-with-button">
          <div class="text-orange-1000">Checking for updates&hellip;</div>
          <button class={buttonStyles} onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      );

    case 'downloading': {
      const { major, minor, patch } = updateState.downloadVersion;
      const { progress } = updateState;
      const dbLabel =
        updateState.dbName === 'kanjidb' ? 'kanji data' : 'radical data';
      const label = `Downloading ${dbLabel} version ${major}.${minor}.${patch} (${Math.round(
        progress * 100
      )}%)`;
      return (
        <div class="status-with-button">
          <div class="details">
            <div class="overlaid-progress progress">
              <progress max="100" value={progress * 100} id="update-progress" />
              <label for="update-progress">{label}&hellip;</label>
            </div>
          </div>
          <button class={buttonStyles} onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      );
    }

    case 'updatingdb': {
      const { major, minor, patch } = updateState.downloadVersion;
      const dbLabel =
        updateState.dbName === 'kanjidb'
          ? 'kanji database'
          : 'radical database';
      const label = `Updating ${dbLabel} to version ${major}.${minor}.${patch}`;
      return (
        <div class="status-with-button">
          <div class="details">
            <div class="overlaid-progress progress">
              <progress id="update-progress" />
              <label for="update-progress">{label}&hellip;</label>
            </div>
          </div>
          <button class={disabledButtonStyles} disabled>
            Cancel
          </button>
        </div>
      );
    }

    case 'error':
      return (
        <div>
          {renderDatabaseSummary(props)}
          <div class="status-with-button error">
            <div class="error-message">
              Update failed: {updateState.error.message}
            </div>
            <button class={buttonStyles} onClick={props.onUpdate}>
              Retry
            </button>
          </div>
        </div>
      );
  }

  return null;
}

function renderDatabaseSummary(props: Props): JSX.Element | null {
  if (!props.databaseVersions.kanjidb) {
    return null;
  }

  const kanjiDbVersion = props.databaseVersions.kanjidb;

  return (
    <div class="database-summary">
      Includes data from{' '}
      <a
        href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project"
        target="_blank"
      >
        KANJIDIC
      </a>{' '}
      version {kanjiDbVersion.databaseVersion} generated on{' '}
      {kanjiDbVersion.dateOfCreation}. This data is the property of the{' '}
      <a href="https://www.edrdg.org/" target="_blank">
        Electronic Dictionary Research and Development Group
      </a>
      , and is used in conformance with the Group's{' '}
      <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank">
        licence
      </a>
      .
    </div>
  );
}

function renderLangSelector(props: Props): JSX.Element {
  const selectedLang = props.databaseVersions.kanjidb
    ? props.databaseVersions.kanjidb.lang
    : 'en';

  return (
    <select
      name="lang"
      class="lang-selector"
      onChange={evt => {
        if (evt && evt.target && props.onSetLang) {
          props.onSetLang((evt.target as HTMLSelectElement).value);
        }
      }}
    >
      {DB_LANGUAGES.map(lang => (
        <option value={lang} selected={lang === selectedLang}>
          {DB_LANGUAGE_NAMES.get(lang)!}
        </option>
      ))}
    </select>
  );
}

// Our special date formatting that is a simplified ISO 8601 in local time
// without seconds.
function formatDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
