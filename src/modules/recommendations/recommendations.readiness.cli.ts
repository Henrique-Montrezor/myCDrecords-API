import { analyzeSyntheticReadiness, createSyntheticReadinessDataset } from "./recommendations.readiness";

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 1 || args[0] !== "--synthetic") {
        console.error("Uso: npm run ml:readiness -- --synthetic. Apenas dados sinteticos internos; sem acesso ao banco ou importacao de arquivos.");
        process.exitCode = 2;
    } else {
        console.log(JSON.stringify(analyzeSyntheticReadiness(createSyntheticReadinessDataset()), null, 2));
    }
}
