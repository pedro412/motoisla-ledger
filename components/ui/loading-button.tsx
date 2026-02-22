import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

type LoadingButtonProps = ButtonProps & {
  loading?: boolean;
  loadingText?: string;
};

export function LoadingButton({
  loading = false,
  loadingText = "Cargando...",
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <ButtonSpinner />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
