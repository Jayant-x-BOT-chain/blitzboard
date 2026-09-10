import { Zap, GithubIcon, XIcon } from 'lucide-react';
import './Footer.css';

export function Footer() {
    return (
        <footer className="footer">
            <div className="container footer-container">
                <div className="footer-logo">
                    <a href="/" className="logo">
                        <div className="logo-icon">
                            <Zap size={20} strokeWidth={2.5} />
                        </div>
                        <span className="logo-text">Blitzboard</span>
                    </a>
                </div>

                <div className="footer-social">
                    <a href="https://github.com/iam-jayant" className="social-link" aria-label="Github">
                        <GithubIcon size={20} />
                    </a>
                    <a href="https://x.com/0xjayantxyz" className="social-link" aria-label="X">
                        <XIcon size={20} />
                    </a>
                </div>
            </div>

            <div className="footer-bottom">
                <p className="footer-copyright">
                    Built during Road to Blitz Nagpur
                </p>
            </div>
        </footer>
    );
}
