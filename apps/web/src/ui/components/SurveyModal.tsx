import type { JSX } from 'preact';
import type { AnalyticsEventMap } from '../../ops/events';
import { useT } from '../services';
import { Button } from './Button';
import { Modal } from './Modal';

type Answer = AnalyticsEventMap['survey_answer']['answer'];

/** The one-question survey after level 10 (supporting evidence for the go decision). */
export function SurveyModal({ onAnswer }: { onAnswer(answer: Answer): void }): JSX.Element {
  const t = useT();
  return (
    <Modal title={t('survey.question')} onClose={() => onAnswer('skip')}>
      <div class="stack">
        <Button onClick={() => onAnswer('very')}>{t('survey.very')}</Button>
        <Button onClick={() => onAnswer('somewhat')}>{t('survey.somewhat')}</Button>
        <Button onClick={() => onAnswer('not')}>{t('survey.not')}</Button>
        <Button onClick={() => onAnswer('skip')}>{t('survey.skip')}</Button>
      </div>
    </Modal>
  );
}
