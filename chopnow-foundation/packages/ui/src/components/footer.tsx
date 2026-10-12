import * as React from "react";
import { cn } from "@chopnow/lib";

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  brand?: React.ReactNode;
  columns?: FooterColumn[];
  /** e.g. "© 2026 ChopNow. Made with care in Ekpoma, Edo State." */
  bottomText?: string;
}

export function Footer({ brand, columns = [], bottomText, className, ...props }: FooterProps) {
  return (
    <footer className={cn("border-t border-border bg-secondary text-secondary-foreground", className)} {...props}>
      {(brand || columns.length > 0) && (
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4 md:px-8">
          {brand && <div>{brand}</div>}
          {columns.map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-[13px] font-bold opacity-90">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-[12.5px] opacity-50 transition-opacity hover:opacity-100"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {bottomText && (
        <div className="border-t border-white/10 py-5 text-center text-[11.5px] opacity-40">
          {bottomText}
        </div>
      )}
    </footer>
  );
}
