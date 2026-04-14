'use client';

type Props = { isHomeView: boolean; onBackHome: () => void };

export default function PortalButton({ isHomeView, onBackHome }: Props) {
  if (isHomeView) {
    return (
      <div className="fixed top-4 left-4 z-[100]">
        <a
          href="https://deepbraintechnology.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-2.5 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-full shadow-md transition cursor-pointer"
        >
          Back to Main Portal
        </a>
      </div>
    );
  }
  return (
    <div className="fixed top-4 left-4 z-[100]">
      <button
        type="button"
        onClick={onBackHome}
        className="px-6 py-2.5 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-full shadow-md transition cursor-pointer"
      >
        Back to home
      </button>
    </div>
  );
}
