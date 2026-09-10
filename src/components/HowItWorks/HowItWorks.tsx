import { Users, Bot, Vote, BarChart } from 'lucide-react';
import './HowItWorks.css';

interface Step {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const steps: Step[] = [
    {
        icon: <Users size={32} />,
        title: '1. Community Submission',
        description: 'Builders and participants submit their projects to active events via their connected wallets.',
    },
    {
        icon: <Bot size={32} />,
        title: '2. AI Agent Analysis',
        description: 'Botchain AI Agents analyze submissions, providing objective scoring based on predefined criteria.',
    },
    {
        icon: <Vote size={32} />,
        title: '3. On-Chain Voting',
        description: 'Human voters and AI Agents cast their votes on Botchain, ensuring transparent and immutable consensus.',
    },
    {
        icon: <BarChart size={32} />,
        title: '4. Dynamic Leaderboard',
        description: 'The leaderboard updates in real-time as votes are tallied, revealing the top projects instantly.',
    },
];

export function HowItWorks() {
    return (
        <section className="how-it-works-section">
            <div className="container">
                <h2 className="section-title">How It Works</h2>
                <div className="steps-container">
                    {steps.map((step, index) => (
                        <div key={index} className="step-card">
                            <div className="step-icon-wrapper">
                                {step.icon}
                            </div>
                            <h3 className="step-title">{step.title}</h3>
                            <p className="step-description">{step.description}</p>
                            {index < steps.length - 1 && (
                                <div className="step-connector"></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
