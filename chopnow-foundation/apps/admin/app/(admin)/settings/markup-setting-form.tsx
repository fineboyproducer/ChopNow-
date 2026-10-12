"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Card, Button, FormField, Input } from "@chopnow/ui";
import { formatNaira } from "@chopnow/lib";
import type { ApiResponse } from "@chopnow/types";
import { updateGlobalMarkupAction } from "@/lib/actions/settings";

const initialState: ApiResponse<null> = { success: true, data: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save markup"}
    </Button>
  );
}

export function MarkupSettingForm({ currentMarkup }: { currentMarkup: number }) {
  const [state, formAction] = useFormState(updateGlobalMarkupAction, initialState);
  const [previewMarkup, setPreviewMarkup] = React.useState(currentMarkup);

  const exampleBase = 2500;
  const exampleMarkupAmount = Math.round((exampleBase * previewMarkup) / 100);
  const exampleFinal = Math.round((exampleBase + exampleMarkupAmount) / 10) * 10;

  return (
    <Card className="p-5">
      <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Global markup</p>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        Applied on top of every restaurant&apos;s own price before it&apos;s shown to customers, unless
        that restaurant has a markup override set on its detail page (PRD Section 7.1).
      </p>

      <form action={formAction} className="space-y-4">
        <FormField label="Markup percentage" htmlFor="markupPercent">
          <Input
            id="markupPercent"
            name="markupPercent"
            type="number"
            min={0}
            max={100}
            step={0.5}
            defaultValue={currentMarkup}
            onChange={(e) => setPreviewMarkup(Number(e.target.value) || 0)}
          />
        </FormField>

        <div className="rounded-xl bg-muted p-3.5 text-[12.5px]">
          <p className="mb-2 font-bold text-foreground">Example</p>
          <div className="flex justify-between text-muted-foreground">
            <span>Restaurant price</span>
            <span>{formatNaira(exampleBase)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Markup ({previewMarkup}%)</span>
            <span>+{formatNaira(exampleMarkupAmount)}</span>
          </div>
          <div className="mt-1.5 flex justify-between border-t border-dashed border-border pt-1.5 font-bold text-foreground">
            <span>Customer sees</span>
            <span>{formatNaira(exampleFinal)}</span>
          </div>
        </div>

        {!state.success && <p className="text-[12.5px] font-medium text-destructive">{state.error.message}</p>}

        <SubmitButton />
      </form>
    </Card>
  );
}
