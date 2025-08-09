"use client";
import { useState } from 'react';
import Step1 from '../components/Step1';
import Step2 from '../components/Step2';
import Step3 from '../components/Step3';
import Step4 from '../components/Step4';
import Step5 from '../components/Step5';

export default function Page() {
  const [step, setStep] = useState<number>(1);
  const [state2, setState2] = useState<any>(null);
  const [output3, setOutput3] = useState<any>(null);

  const restart = () => {
    setStep(1);
    setState2(null);
    setOutput3(null);
  };

  return (
    <main className="min-h-screen">
      {step === 1 && <Step1 onNext={() => setStep(2)} />}
      {step === 2 && (
        <Step2
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          onUpdate={(s) => setState2(s)}
        />
      )}
      {step === 3 && state2 && (
        <Step3
          state2={state2}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          onOutput={(data) => setOutput3(data)}
        />
      )}
      {step === 4 && state2 && output3 && (
        <Step4
          currency={state2.currency}
          platforms={state2.platforms}
          seasonality={state2.seasonality}
          nightsBySeasonDay={output3.nightsBySeasonDay}
          priceTable={output3.priceTable}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
        />
      )}
      {step === 5 && <Step5 onRestart={restart} />}
    </main>
  );
}
