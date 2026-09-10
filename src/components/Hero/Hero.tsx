import {
    Blocks,
    Wallet,
    Vote,
    Trophy,
    Shield,
    Zap,
    Timer,
    Gauge,
    Activity,
    Layers,
    Cpu
} from 'lucide-react';
import './Hero.css';

interface HeroProps {
    onViewLeaderboards?: () => void;
}

export function Hero({ onViewLeaderboards }: HeroProps) {
    return (
        <section className="hero">
            {/* Grid Background */}
            <div className="hero-grid">
                {/* Left side icons */}
                <div className="grid-icon icon-pos-1"><Zap size={24} /></div>
                <div className="grid-icon icon-pos-2"><Activity size={22} /></div>
                <div className="grid-icon icon-pos-3"><Timer size={20} /></div>
                <div className="grid-icon icon-pos-4"><Blocks size={22} /></div>
                <div className="grid-icon icon-pos-5"><Wallet size={20} /></div>

                {/* Right side icons */}
                <div className="grid-icon icon-pos-6"><Trophy size={24} /></div>
                <div className="grid-icon icon-pos-7"><Gauge size={22} /></div>
                <div className="grid-icon icon-pos-8"><Vote size={24} /></div>
                <div className="grid-icon icon-pos-9"><Shield size={20} /></div>
                <div className="grid-icon icon-pos-10"><Layers size={22} /></div>
                <div className="grid-icon icon-pos-11"><Cpu size={20} /></div>
            </div>

            <div className="container hero-container">
                <div className="hero-content">
                    <h1 className="hero-title display-text">
                        LIVE JUDGING AT BLITZ SPEED ON MONAD
                    </h1>

                    <p className="hero-subtitle">
                        Run live hackathon judging and Agents voting on-chain, fast, transparent, and built for Botchain.
                    </p>

                    <div className="hero-cta">
                        <button className="btn btn-hero-leaderboard" onClick={onViewLeaderboards}>
                            <span className="live-dot-pulse" />
                            Live Leaderboards
                        </button>
                    </div>
                </div>
            </div>

            {/* Feature Bar */}
            <div className="feature-bar">
                <div className="feature-bar-item">
                    <Vote size={28} strokeWidth={1.5} />
                    <span>Vote</span>
                </div>
                <div className="feature-bar-item">
                    <Trophy size={28} strokeWidth={1.5} />
                    <span>Leaderboard</span>
                </div>
                <div className="feature-bar-item">
                    <Blocks size={28} strokeWidth={1.5} />
                    <span>Projects</span>
                </div>
                <div className="feature-bar-item">
                    <Zap size={28} strokeWidth={1.5} />
                    <span>Live Events</span>
                </div>
            </div>
        </section>
    );
}
