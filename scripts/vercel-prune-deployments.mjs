#!/usr/bin/env node
/**
 * Deletes the old deployments of a Vercel project — the only thing that makes the storage
 * counters go down (D139).
 *
 *   VERCEL_TOKEN=… node scripts/vercel-prune-deployments.mjs              # dry run, deletes nothing
 *   VERCEL_TOKEN=… node scripts/vercel-prune-deployments.mjs --yes        # deletes
 *   … --keep-days=2 --keep-production=3 --yes
 *
 * A deployment is kept until someone removes it, and each one holds its own copy of every
 * serverless function it built. On 15 September the account was carrying 9,92 Go of Functions
 * Storage and 6,78 Go of Deployment Storage, almost all of it previews of branches that had
 * already been merged.
 *
 * What is never deleted:
 *   * the deployment currently serving production (read from the project itself, not guessed);
 *   * the last `--keep-production` production deployments, so a rollback stays possible;
 *   * anything younger than `--keep-days` days, so the previews under review survive.
 *
 * The token is a Vercel personal access token (Vercel → Settings → Tokens), scoped to the team.
 * It is passed in the environment and never written to the repository. Deleting a deployment is
 * irreversible: its preview URL stops answering. The code is in git, so a deleted preview is one
 * `git push` away from existing again.
 */
const API = "https://api.vercel.com";
const TEAM = process.env.VERCEL_TEAM_ID ?? "team_l4eKZlK2hCoMQUArQO0TwwAt";
const PROJECT = process.env.VERCEL_PROJECT_ID ?? "prj_7d0bAaCfWquNfW14ClRUG3H7ieAX";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};

const token = process.env.VERCEL_TOKEN;
const commit = process.argv.includes("--yes");
const keepDays = arg("keep-days", 2);
const keepProduction = arg("keep-production", 3);

async function api(path, init = {}) {
  const url = `${API}${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM}`;
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (response.status === 429) {
    const wait = Number(response.headers.get("retry-after") ?? 10);
    console.log(`  429 — pause de ${wait}s`);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    return api(path, init);
  }
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${response.status}`);
  return response.json();
}

/** Every deployment of the project. The API pages backwards by creation date. */
async function allDeployments() {
  const out = [];
  let until;
  for (;;) {
    const page = await api(
      `/v6/deployments?projectId=${PROJECT}&limit=100${until ? `&until=${until}` : ""}`,
    );
    const batch = page.deployments ?? [];
    if (batch.length === 0) break;
    out.push(...batch);
    const next = page.pagination?.next;
    if (!next) break;
    until = next;
  }
  return out;
}

async function main() {
  if (!token) throw new Error("VERCEL_TOKEN is required (Vercel → Settings → Tokens)");

  const project = await api(`/v9/projects/${PROJECT}`);
  const live = project.targets?.production?.id;
  const deployments = await allDeployments();
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  const production = deployments
    .filter((deployment) => deployment.target === "production")
    .sort((a, b) => b.created - a.created)
    .slice(0, keepProduction)
    .map((deployment) => deployment.uid ?? deployment.id);
  const keep = new Set([live, ...production].filter(Boolean));

  const doomed = deployments.filter((deployment) => {
    const id = deployment.uid ?? deployment.id;
    const busy = deployment.state === "BUILDING" || deployment.state === "QUEUED";
    return !keep.has(id) && deployment.created < cutoff && !busy;
  });

  const oldest = deployments.at(-1);
  const since = oldest ? new Date(oldest.created).toISOString().slice(0, 10) : "?";
  console.log(`${deployments.length} déploiements, le plus ancien du ${since}`);
  console.log(
    `gardés : la production en ligne + ${production.length} rollbacks + tout ce qui a moins de ${keepDays} j`,
  );
  console.log(
    `${doomed.length} à supprimer${commit ? "" : " — essai à blanc, rien n'est touché (--yes pour supprimer)"}`,
  );
  if (!commit || doomed.length === 0) return;

  let done = 0;
  for (const deployment of doomed) {
    const id = deployment.uid ?? deployment.id;
    try {
      await api(`/v13/deployments/${id}`, { method: "DELETE" });
      done += 1;
      if (done % 25 === 0) console.log(`  ${done}/${doomed.length}`);
    } catch (error) {
      console.error(`  ${id} — ${error.message}`);
    }
  }
  console.log(
    `${done} déploiements supprimés. Les compteurs du tableau de bord suivent en quelques minutes.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
