import type { ButtonHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

const CHIP_TONES = {
  dark: "aria-pressed:border-zinc-900 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:aria-pressed:border-white dark:aria-pressed:bg-white dark:aria-pressed:text-black",
  sky: "aria-pressed:border-sky-600 aria-pressed:bg-sky-600 aria-pressed:text-white",
  amber: "aria-pressed:border-amber-600 aria-pressed:bg-amber-600 aria-pressed:text-white",
};

export function Chip({
  pressed,
  tone = "sky",
  children,
  ...props
}: { pressed: boolean; tone?: keyof typeof CHIP_TONES; children: ReactNode } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
>) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`rounded-full border border-zinc-300 px-3 py-1 text-sm capitalize dark:border-zinc-700 ${CHIP_TONES[tone]}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  ...props
}: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="w-full rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 sm:w-auto dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      {...props}
    >
      {children}
    </button>
  );
}

export function SmallButton({
  children,
  ...props
}: { children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
