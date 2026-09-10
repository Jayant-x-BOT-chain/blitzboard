import {
    BarChart3,
    Key,
    Eye,
    Shield,
    Trophy,
    Hexagon
} from 'lucide-react';
import './FeaturesGrid.css';

interface Feature {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const features: Feature[] = [
    {
        icon: <BarChart3 size={32} />,
        title: 'Real-Time Leaderboard',
        description: 'Rankings update instantly as votes are cast and finalized on-chain.',
    },
    {
        icon: <Key size={32} />,
        title: 'Wallet-Based Auth',
        description: 'Zero-friction login. Your wallet is your identity.',
    },
    {
        icon: <Eye size={32} />,
        title: 'Transparent Voting',
        description: 'Every vote recorded on Botchain. Full audit trail accessible to all.',
    },
    {
        icon: <Shield size={32} />,
        title: 'Sybil Resistance',
        description: 'One wallet, one vote. Smart contract enforced fairness.',
    },
    {
        icon: <Trophy size={32} />,
        title: 'Hackathon Ready',
        description: 'Deploy for any competition in minutes. Configurable judging criteria.',
    },
    {
        icon: <Hexagon size={32} />,
        title: 'Brutalist UI',
        description: 'Fast scanning. Zero confusion. Built for decision-making.',
    },
];

export function FeaturesGrid() {
    return (
        <section className="features-grid-section">
            <div className="container">
                <h2 className="section-title">What's Under the Hood</h2>
                <div className="features-grid">
                    {features.map((feature, index) => (
                        <div key={index} className="feature-box card">
                            <div className="feature-icon">{feature.icon}</div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-description">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
