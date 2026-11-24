import { useEffect, useId, useRef, useState } from 'react';
import { MAX_MOVE_VOLUME, type GameSettings } from '@/lib/game/settings';
import { previewVolume, stopVolumePreview } from '@/lib/sound';
import { GameIcon } from './GameArtwork';
import dialogStyles from './ClassicResultDialog.module.css';
import styles from './SettingsDialog.module.css';

type Props = {
  settings: GameSettings;
  onSave: (settings: GameSettings) => void;
  onClose: () => void;
  onRules: () => void;
};

const switches = [
  { key: 'sound', label: 'Sound', icon: 'sound', width: 56.6296, height: 55.97 },
  { key: 'showNextMoves', label: 'Show Next Moves', icon: 'next-moves', width: 58.2483, height: 60.91 },
  { key: 'showTimer', label: 'Show Timer', icon: 'timer', width: 50.3054, height: 63.56 },
] as const;

export default function SettingsDialog({ settings, onSave, onClose, onRules }: Props) {
  const [draft, setDraft] = useState(settings);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const volume = useId();

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    return stopVolumePreview;
  }, []);

  return <dialog ref={dialog} className={`${dialogStyles.dialog} ${styles.dialog}`} aria-labelledby={title} {...{ closedby: 'any' }}
    onClose={event => {
      const modal = event.currentTarget;
      const action = modal.returnValue;
      modal.returnValue = '';
      stopVolumePreview();
      if (action === 'done') onSave(draft);
      if (action === 'rules') onRules();
      else onClose();
    }}>
    <form method="dialog" className={`${dialogStyles.panel} ${styles.panel}`}>
      <h2 className={`${dialogStyles.title} ${styles.heading}`} id={title}>Settings</h2>
      <div className={styles.options}>
        {switches.map(({ key, label, icon, width, height }) => <label className={`${styles.option} ${styles.switchRow}`} key={key}>
          <span className={styles.label}>
            <span className={styles.optionIcon}><GameIcon directory="settings" name={icon} width={width} height={height} /></span>
            {label}
          </span>
          <input className="sr-only" type="checkbox" role="switch" {...{ switch: '' }} checked={draft[key]}
            onChange={event => {
              const checked = event.currentTarget.checked;
              if (key === 'sound' && !checked) stopVolumePreview();
              setDraft({ ...draft, [key]: checked });
            }} />
          <span className={styles.switchArtwork} data-on={draft[key]} aria-hidden="true" />
        </label>)}
        <div className={`${styles.option} ${styles.volumeOption}`}>
          <label className={styles.label} htmlFor={volume}>
            <span className={styles.optionIcon}><GameIcon directory="settings" name="volume" width={56.6296} height={55.97} /></span>
            Volume
          </label>
          <div className={styles.volumeControl}>
            <input type="range" id={volume} min={0} max={MAX_MOVE_VOLUME} step={1} value={draft.volume}
              aria-valuetext={`${draft.volume / MAX_MOVE_VOLUME * 100}%`}
              onChange={event => {
                const volume = event.currentTarget.valueAsNumber;
                setDraft({ ...draft, volume });
                if (draft.sound) previewVolume(volume / MAX_MOVE_VOLUME);
              }} />
            <span className={styles.volumeArtwork} aria-hidden="true">
              <GameIcon directory="settings" name="volume-track" width={303} height={35} />
              <span className={styles.volumeSegments}>
                {Array.from({ length: MAX_MOVE_VOLUME }, (_, index) => <GameIcon key={index} directory="settings"
                  name={index < draft.volume ? 'volume-on' : 'volume-off'} width={25} height={23} />)}
              </span>
            </span>
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="submit" value="rules" aria-haspopup="dialog" className={`${dialogStyles.button} ${styles.action} ${styles.rules}`}>
          <span><GameIcon name="help" width={34.0638} height={35.5984} /></span> Rules
        </button>
        <button type="submit" value="done" className={`${dialogStyles.button} ${styles.action} ${styles.done}`}>
          <span><GameIcon directory="settings" name="done" width={30.9671} height={25.538} /></span> Done
        </button>
      </div>
      <button type="submit" value="close" aria-label="Close settings" className={`${dialogStyles.button} ${dialogStyles.close} ${styles.close}`}>
        <GameIcon directory="classic-results" name="close" width={25.1881} height={26.5263} />
      </button>
    </form>
  </dialog>;
}
