"use client";

export default function Step5({ onRestart }: { onRestart: () => void }) {
  return (
    <section className="max-w-3xl mx-auto p-6 text-center">
      <div className="text-sm mb-4">Step 5 of 5</div>
      <h2 className="text-2xl font-semibold mb-4">Thank you!</h2>
      <p className="mb-4 text-base">
        We hope you found the Dynamic Pricing Tool helpful. Feel free to export your rates and
        paste them into your booking platforms. If you enjoyed using this tool, please rate it
        and share your feedback.
      </p>
      <div className="flex justify-center space-x-2 mb-4">
        {[1,2,3,4,5].map((star) => (
          <span key={star} className="text-yellow-500 text-2xl">★</span>
        ))}
      </div>
      <p className="mb-6 text-sm text-gray-600">(Ratings are for demonstration only.)</p>
      <button
        className="h-11 px-4 bg-black text-white rounded-lg"
        onClick={onRestart}
      >
        Start over
      </button>
    </section>
  );
}