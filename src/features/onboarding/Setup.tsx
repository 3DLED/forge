/**
 * The first open, for somebody who has never used the app.
 *
 * Four short questions, each of which changes what the app does next rather than decorating a
 * welcome: which units and language it talks in, what equipment the suggestions can use, what
 * the training is for, and whether to put a plan on the calendar. Everything else the app can
 * do is discoverable later and does not belong in the way of a first workout.
 *
 * Every step can be skipped, and the whole thing can be. A tester handed a phone and told to
 * try it should be one tap from the app, not four screens of somebody else's opinions.
 *
 * Answers save as they are given, not at the end. Closing the app on step three keeps steps one
 * and two, and the next launch opens setup again from the start with those already chosen.
 */

import { useEffect, useState } from 'react';
import { useApp } from '../../ui/AppProvider';
import { profileRepo } from '../../data/repos';
import { lockScroll } from '../../ui/scrollLock';
import { LANGUAGES } from '../../domain/lang';
import GoalPicker from '../more/GoalPicker';
import PlanLibrary from '../plan/PlanLibrary';
import { useT } from '../../i18n/useT';

type Step = 'welcome' | 'equipment' | 'goal' | 'plan';
const STEPS: Step[] = ['welcome', 'equipment', 'goal', 'plan'];

export default function Setup() {
  const t = useT();
  const { profile, equipmentProfiles, activeEquipment } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => lockScroll(), []);

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const back = () => setStep(STEPS[Math.max(index - 1, 0)]);
  const finish = () => void profileRepo.update(profile.id, { onboardedAt: new Date().toISOString() });

  return (
    <div className="setup" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="setup-body">
        <div className="setup-top">
          <span className="tiny faint mono">
            {index + 1} / {STEPS.length}
          </span>
          <button className="btn ghost sm" onClick={finish}>
            {t('Skip setup')}
          </button>
        </div>

        {step === 'welcome' && (
          <>
            <h1 id="setup-title">{t('Welcome to Hybrid Forge')}</h1>
            <p className="muted">
              {t('A few quick questions so the first workout it suggests fits what you have and what you are training for. Everything here can be changed later under More.')}
            </p>

            <div className="section-title">{t('Language')}</div>
            <div className="row" style={{ gap: '0.5rem' }}>
              {LANGUAGES.map(({ code, name }) => (
                <button
                  key={code}
                  className={`btn grow${(profile.language ?? 'en') === code ? ' primary' : ''}`}
                  onClick={() => void profileRepo.update(profile.id, { language: code })}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="section-title">{t('Units')}</div>
            <div className="row" style={{ gap: '0.5rem' }}>
              <button
                className={`btn grow${profile.units === 'imperial' ? ' primary' : ''}`}
                onClick={() => void profileRepo.update(profile.id, { units: 'imperial' })}
              >
                {t('Pounds and miles')}
              </button>
              <button
                className={`btn grow${profile.units === 'metric' ? ' primary' : ''}`}
                onClick={() => void profileRepo.update(profile.id, { units: 'metric' })}
              >
                {t('Kilograms and kilometres')}
              </button>
            </div>
          </>
        )}

        {step === 'equipment' && (
          <>
            <h1 id="setup-title">{t('What do you train with?')}</h1>
            <p className="muted">
              {t('Pick the closest match. You can add or remove single pieces, and set the weights of the bells you own, under More.')}
            </p>
            <div className="stack">
              {equipmentProfiles.map((kit) => (
                <button
                  key={kit.id}
                  className={`pick${activeEquipment?.id === kit.id ? ' on' : ''}`}
                  aria-pressed={activeEquipment?.id === kit.id}
                  onClick={() => void profileRepo.update(profile.id, { activeEquipmentProfileId: kit.id })}
                >
                  <span className="grow">
                    <strong>{kit.name}</strong>
                    <br />
                    <span className="tiny faint">{t.count(kit.items.length, 'item')}</span>
                  </span>
                  {activeEquipment?.id === kit.id && <span className="pill accent">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'goal' && (
          <>
            <h1 id="setup-title">{t('What are you training for?')}</h1>
            <p className="muted">
              {t('It shapes the sets, reps and rest the app suggests. Pick the nearest one; it is easy to change.')}
            </p>
            <GoalPicker profile={profile} />
          </>
        )}

        {step === 'plan' && (
          <>
            <h1 id="setup-title">{t('Want a plan to follow?')}</h1>
            <p className="muted">
              {t('A plan puts sessions on your calendar and adjusts them as you go. You can also just start a workout whenever you like.')}
            </p>
            <button className="btn primary block" onClick={() => setBrowsing(true)}>
              {t('Browse plans')}
            </button>
          </>
        )}

        <div className="setup-actions">
          {index > 0 && (
            <button className="btn grow" onClick={back}>
              {t('Back')}
            </button>
          )}
          {step === 'plan' ? (
            <button className="btn grow" onClick={finish}>
              {t('Finish')}
            </button>
          ) : (
            <button className="btn primary grow" onClick={next}>
              {t('Next')}
            </button>
          )}
        </div>
      </div>

      {/* Closing the library returns here rather than finishing: backing out is not an answer. */}
      {browsing && <PlanLibrary onClose={() => setBrowsing(false)} />}
    </div>
  );
}
