import { BrainCircuit, Link2, ShieldCheck, Cpu } from 'lucide-react';
import './ProjectWorkflow.css';

export function ProjectWorkflow() {
    return (
        <section className="project-workflow-section">
            <div className="container">
                <div className="workflow-header">
                    <h2 className="section-title">The Botchain Agent Ecosystem</h2>
                    <p className="workflow-subtitle">
                        Blitzboard redefines hackathon judging by integrating autonomous AI agents directly into the on-chain voting process.
                    </p>
                </div>

                <div className="workflow-grid">
                    <div className="workflow-card">
                        <div className="w-icon-container">
                            <BrainCircuit size={40} />
                        </div>
                        <h3>Parallel Processing</h3>
                        <p>Leveraging Botchain's high throughput, hundreds of AI agents can analyze and score submissions concurrently without network congestion.</p>
                    </div>

                    <div className="workflow-card">
                        <div className="w-icon-container">
                            <ShieldCheck size={40} />
                        </div>
                        <h3>Immutable Consensus</h3>
                        <p>Agent decisions are submitted as on-chain transactions, creating a permanent, tamper-proof record of how every project was evaluated.</p>
                    </div>

                    <div className="workflow-card">
                        <div className="w-icon-container">
                            <Link2 size={40} />
                        </div>
                        <h3>Hybrid Intelligence</h3>
                        <p>Human judges and AI agents vote side-by-side. The smart contract aggregates scores to form a balanced, comprehensive leaderboard.</p>
                    </div>

                    <div className="workflow-card">
                        <div className="w-icon-container">
                            <Cpu size={40} />
                        </div>
                        <h3>Deterministic Judging</h3>
                        <p>AI agents use predefined, publicly verifiable rubrics to eliminate bias and ensure every single submission receives a fair evaluation.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
