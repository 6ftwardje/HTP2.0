import { saveOnboarding, skipOnboarding } from "@/app/actions/onboarding";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { RightRailCard } from "@/components/layout/RightRailCard";
import { ensureCurrentStudent } from "@/lib/students";
import { getStudentOnboardingResponse } from "@/lib/onboarding";

function fieldClass() {
  return "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border))]";
}

export default async function OnboardingPage() {
  const { student } = await ensureCurrentStudent();
  const response = student
    ? await getStudentOnboardingResponse(student.id)
    : null;
  const tools = response?.tools ?? {};

  const rail = (
    <>
      <RightRailCard title="Waarom dit?">
        <p className="cb-caption leading-relaxed">
          Je mentor ziet sneller waar je staat, waar je tegenaan loopt en welke
          begeleiding op dit moment het meeste verschil maakt.
        </p>
      </RightRailCard>
      <RightRailCard title="Kort houden">
        <p className="cb-caption leading-relaxed">
          Dit is geen intakeformulier van drie kwartier. Vul genoeg in zodat je
          traject persoonlijker kan starten.
        </p>
      </RightRailCard>
    </>
  );

  const main = (
    <section className="cb-panel p-5 sm:p-7">
      <form action={saveOnboarding} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="cb-eyebrow">Ervaring</span>
            <select
              name="experience_level"
              defaultValue={response?.experience_level ?? ""}
              className={fieldClass()}
            >
              <option value="">Kies je niveau</option>
              <option value="beginner">Beginner</option>
              <option value="some_experience">Ik heb al wat ervaring</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="cb-eyebrow">Markt</span>
            <select
              name="primary_market"
              defaultValue={response?.primary_market ?? ""}
              className={fieldClass()}
            >
              <option value="">Waar focus je op?</option>
              <option value="crypto">Crypto</option>
              <option value="forex">Forex</option>
              <option value="indices">Indices</option>
              <option value="stocks">Aandelen</option>
              <option value="not_sure">Nog niet zeker</option>
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="cb-eyebrow">Grootste uitdaging</span>
          <textarea
            name="main_challenge"
            rows={4}
            defaultValue={response?.main_challenge ?? ""}
            placeholder="Bijvoorbeeld: geen structuur, te veel risico, FOMO, entries herkennen..."
            className={fieldClass()}
          />
        </label>

        <label className="block space-y-2">
          <span className="cb-eyebrow">90 dagen doel</span>
          <textarea
            name="goal_90_days"
            rows={3}
            defaultValue={response?.goal_90_days ?? ""}
            placeholder="Wat wil je binnen 90 dagen concreet beter kunnen?"
            className={fieldClass()}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="cb-eyebrow">Tijd per week</span>
            <select
              name="weekly_time_commitment"
              defaultValue={response?.weekly_time_commitment ?? ""}
              className={fieldClass()}
            >
              <option value="">Kies tijd</option>
              <option value="0_2">0-2 uur</option>
              <option value="3_5">3-5 uur</option>
              <option value="6_10">6-10 uur</option>
              <option value="10_plus">10+ uur</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="cb-eyebrow">Begeleiding</span>
            <select
              name="mentorship_interest"
              defaultValue={response?.mentorship_interest ?? ""}
              className={fieldClass()}
            >
              <option value="">Waar heb je behoefte aan?</option>
              <option value="self_paced">Vooral zelfstandig leren</option>
              <option value="group_calls">Groepscalls/Q&A</option>
              <option value="personal_feedback">Persoonlijke feedback</option>
              <option value="mentorship">Mentorship traject</option>
            </select>
          </label>
        </div>

        <fieldset className="space-y-3">
          <legend className="cb-eyebrow">Tools</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["tool_tradingview", "TradingView", tools.tradingview],
              ["tool_tradezella", "TradeZella", tools.tradezella],
              ["tool_discord", "Discord", tools.discord],
            ].map(([name, label, checked]) => (
              <label
                key={String(name)}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,var(--muted)_8%)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
              >
                <input
                  name={String(name)}
                  type="checkbox"
                  defaultChecked={Boolean(checked)}
                  className="h-4 w-4"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center">
          <button type="submit" className="cb-btn cb-btn-primary">
            Intake opslaan
          </button>
          <button
            type="submit"
            formAction={skipOnboarding}
            className="cb-btn cb-btn-secondary"
          >
            Later invullen
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Intake" }]}
        eyebrow="Startpunt"
        title="Maak je traject persoonlijker"
        description="Vertel kort waar je staat. Dit maakt je dashboard en mentorcontext direct bruikbaarder."
      />
      <AppPageLayout main={main} rail={rail} />
    </div>
  );
}
