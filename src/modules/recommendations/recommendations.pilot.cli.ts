import { inspectPilotPlan, pilotPlan } from "./recommendations.pilot";

if (require.main === module) {
    if (process.argv.length !== 2) {
        console.error("Uso: npm run ml:preflight. Diagnostico sem acesso ao banco; nao habilita coleta.");
        process.exitCode = 2;
    } else {
        const report = inspectPilotPlan(pilotPlan);
        console.log(JSON.stringify(report, null, 2));
        process.exitCode = 1;
    }
}
