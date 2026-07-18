interface Props {
  children: React.ReactNode;
  onClose?: () => void;
  maxWidth?: number;
  maxHeight?: string;
}

export default function Modal({ children, onClose, maxWidth = 380, maxHeight }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(38,34,32,0.35)] px-5"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth, maxHeight }}
        className="w-full overflow-y-auto rounded-[18px] bg-porch-surface p-[22px] shadow-[0_12px_40px_rgba(38,34,32,0.2)]"
      >
        {children}
      </div>
    </div>
  );
}
