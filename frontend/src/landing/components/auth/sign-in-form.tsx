
import { Info } from "lucide-react";
import { useState, type FormEvent } from "react";

import { EMAIL, Field, FormAlert, PasswordInput, SubmitButton, TextInput, sendForm } from "@/components/auth/fields";
import { requestPasswordReset, resetPassword } from "../../../api";
import { AUTH_ERRORS } from "@/lib/auth-errors";

type Errors = { email?: string; password?: string };

/**
 * Checks the fields here, then signs in through the FastAPI auth API without
 * leaving the page; a refusal is shown here, with the email still filled in.
 */
export function SignInForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string>();
  const [reset, setReset] = useState<"closed" | "open" | "code" | "sent">("closed");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setAlert(undefined);
    const found: Errors = {};
    const typed = String(data.get("email") ?? "").trim();
    if (!typed) found.email = "Enter your email address.";
    else if (!EMAIL.test(typed)) found.email = "Enter a valid email address, like name@company.com.";
    if (!data.get("password")) found.password = "Enter your password.";
    setErrors(found);
    if (found.email || found.password) {
      document.getElementById(found.email ? "email" : "password")?.focus();
      return;
    }

    setBusy(true);
    const answer = await sendForm(form);
    if (answer.redirect) {
      window.location.assign(answer.redirect);
      return;
    }
    setBusy(false);
    if (answer.error === "fields" && answer.fields) {
      setErrors(answer.fields);
      return;
    }
    setAlert(answer.message ?? AUTH_ERRORS[answer.error ?? "unavailable"] ?? AUTH_ERRORS.unavailable);
  }

  return (
    <form noValidate method="post" action="/api/auth/login" onSubmit={onSubmit} className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {alert ? <FormAlert>{alert}</FormAlert> : null}

      <Field id="email" label="Work email" error={errors.email}>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={!!errors.email}
        />
      </Field>

      <Field
        id="password"
        label="Password"
        error={errors.password}
        aside={
          <button
            type="button"
            onClick={() => setReset(reset === "closed" ? "open" : "closed")}
            className="text-[14px] font-medium text-brand hover:underline"
          >
            Forgot password?
          </button>
        }
      >
        <PasswordInput id="password" name="password" autoComplete="current-password" invalid={!!errors.password} />
      </Field>

      {reset !== "closed" ? (
        <div className="flex gap-2 rounded-lg bg-brand-tint px-3.5 py-3 text-[14px] text-brand-deep">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {reset === "sent" ? (
            <span>Password reset successfully. You can now log in with your new password.</span>
          ) : reset === "code" ? (
            <div className="flex flex-col gap-2">
              <TextInput
                id="reset-code"
                name="reset-code"
                placeholder="6-digit code"
                value={resetCode}
                onChange={(event) => setResetCode(event.target.value)}
              />
              <PasswordInput
                id="new-password"
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <button
                type="button"
                disabled={resetBusy}
                className="font-medium underline underline-offset-2"
                onClick={async () => {
                  setResetBusy(true);
                  try {
                    await resetPassword(email, resetCode, newPassword);
                    setReset("sent");
                  } catch (error) {
                    setAlert(error instanceof Error ? error.message : "The reset code could not be used.");
                  } finally {
                    setResetBusy(false);
                  }
                }}
              >
                Set new password
              </button>
            </div>
          ) : (
            <span>
              Enter your email above, then{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={async () => {
                  if (!EMAIL.test(email.trim())) {
                    setErrors({ email: "Enter the email address you sign in with." });
                    document.getElementById("email")?.focus();
                    return;
                  }
                  setErrors({});
                  setResetBusy(true);
                  try {
                    const code = await requestPasswordReset(email);
                    if (code) setResetCode(code);
                    setReset("code");
                  } catch (error) {
                    setAlert(error instanceof Error ? error.message : "The reset code could not be sent.");
                  } finally {
                    setResetBusy(false);
                  }
                }}
              >
                send me a reset code
              </button>
              .
            </span>
          )}
        </div>
      ) : null}

      <SubmitButton busy={busy}>{busy ? "Logging in" : "Log in"}</SubmitButton>
    </form>
  );
}
