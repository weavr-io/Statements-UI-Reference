export type ViewMode = 'statement' | 'activity';
export type ActivityInstrument = 'account' | 'card';

interface Props {
  mode: ViewMode;
  instrument: ActivityInstrument;
  onModeChange: (mode: ViewMode) => void;
  onInstrumentChange: (instrument: ActivityInstrument) => void;
}

export function ViewSwitcher({ mode, instrument, onModeChange, onInstrumentChange }: Props) {
  return (
    <div className="view-switcher">
      <div className="segmented" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'statement'}
          className={`segment${mode === 'statement' ? ' active' : ''}`}
          onClick={() => onModeChange('statement')}
        >
          Statement
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'activity'}
          className={`segment${mode === 'activity' ? ' active' : ''}`}
          onClick={() => onModeChange('activity')}
        >
          Activity
        </button>
      </div>

      {mode === 'activity' && (
        <div className="segmented segmented-sub" role="tablist" aria-label="Instrument">
          <button
            type="button"
            role="tab"
            aria-selected={instrument === 'account'}
            className={`segment${instrument === 'account' ? ' active' : ''}`}
            onClick={() => onInstrumentChange('account')}
          >
            Account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={instrument === 'card'}
            className={`segment${instrument === 'card' ? ' active' : ''}`}
            onClick={() => onInstrumentChange('card')}
          >
            Card
          </button>
        </div>
      )}
    </div>
  );
}
