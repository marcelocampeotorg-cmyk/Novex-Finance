import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
}) => {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-4 sm:pb-6 border-b border-novex-border/60 mb-4 sm:mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-novex-text-primary">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-novex-text-secondary mt-1">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 md:mt-0 w-full md:w-auto">{actions}</div>}
    </div>
  );
};
