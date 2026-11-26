import React from 'react';
import { ArrowRight, ChevronRight, Cloud, Home, Leaf, Shield, Sparkles, Wind } from 'lucide-react';

function Feature({ icon: Icon, title, text }) {
  return (
    <article className="feature-card">
      <div aria-hidden="true">
        <Icon size={19} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

/**
 * Public AirAware AI landing page explaining core features and data transparency.
 */
export default function LandingPage({ onGetStarted }) {
  return (
    <>
      <section className="landing-hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" /> YOUR EVERYDAY AIR COMPANION
          </div>
          <h1>
            Breathe better,
            <br />
            <em>live smarter.</em>
          </h1>
          <p className="hero-lede">
            Your intelligent companion for understanding air pollution, protecting your family, and making sustainable
            everyday decisions.
          </p>
          <p className="hero-detail">
            AirAware AI brings local air-quality information together with practical, personalized guidance for your home,
            your commute, and your community.
          </p>
          <div className="hero-buttons">
            <button type="button" className="primary-button" onClick={onGetStarted}>
              Get started <ArrowRight size={16} aria-hidden="true" />
            </button>
            <a className="outline-button" href="#features">
              Explore features <ChevronRight size={15} aria-hidden="true" />
            </a>
          </div>
          <div className="hero-proof">
            <div className="proof-icon" aria-hidden="true">
              <Shield size={15} />
            </div>
            <span>
              <strong>Clear about the data.</strong> Practical about the choices.
            </span>
          </div>
        </div>
        <div className="hero-art" role="img" aria-label="Illustration of a green city with trees and clean air">
          <div className="sun-disc" aria-hidden="true" />
          <div className="sky-cloud cloud-a" aria-hidden="true" />
          <div className="sky-cloud cloud-b" aria-hidden="true" />
          <div className="hill hill-back" aria-hidden="true" />
          <div className="hill hill-front" aria-hidden="true" />
          <div className="building b-one" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="building b-two" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="building b-three" aria-hidden="true">
            <i />
            <i />
          </div>
          <div className="tree tree-a" aria-hidden="true">
            <i />
            <b />
          </div>
          <div className="tree tree-b" aria-hidden="true">
            <i />
            <b />
          </div>
          <div className="tree tree-c" aria-hidden="true">
            <i />
            <b />
          </div>
          <div className="art-label">
            <div aria-hidden="true">
              <Wind size={17} />
            </div>
            <span>
              <strong>A little more fresh air</strong>
              <small>Starts with one informed choice</small>
            </span>
          </div>
          <div className="float-leaf leaf-a" aria-hidden="true">
            <Leaf size={17} />
          </div>
          <div className="float-leaf leaf-b" aria-hidden="true">
            <Leaf size={13} />
          </div>
        </div>
      </section>

      <section className="landing-intro" id="about">
        <div className="eyebrow">WHY AIRAWARE EXISTS</div>
        <h2>
          Good decisions start with <em>good information.</em>
        </h2>
        <p>
          Air pollution can make ordinary routines harder to navigate. We help people turn local conditions into
          manageable everyday choices, without assuming every household has the same time, budget, or options.
        </p>
        <div className="intro-pillars">
          <div>
            <span>01</span>
            <strong>Understand the air</strong>
            <p>See readings and forecasts with their source and limitations.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Protect your routine</strong>
            <p>Find practical indoor and outdoor actions for your household.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Make changes that fit</strong>
            <p>Compare realistic travel alternatives and estimated impact.</p>
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-head">
          <div>
            <div className="eyebrow">DESIGNED FOR DAILY LIFE</div>
            <h2>More than a number on a screen.</h2>
          </div>
          <span className="source-note">A practical air-quality action planner</span>
        </div>
        <div className="feature-grid">
          <Feature
            icon={Cloud}
            title="Local air intelligence"
            text="View available pollutant and weather estimates with timestamps and clear data-source labels."
          />
          <Feature
            icon={Sparkles}
            title="Personal daily plan"
            text="Get simple actions shaped around your location, household, commute, and indoor setup."
          />
          <Feature
            icon={Home}
            title="Healthier indoor habits"
            text="Find approachable ways to reduce indoor smoke, dust, and cooking particles."
          />
          <Feature
            icon={Leaf}
            title="Lower-emission choices"
            text="Explore transport options and see transparent, assumption-based emissions estimates."
          />
        </div>
      </section>

      <section className="how-section" id="how">
        <div>
          <div className="eyebrow">HOW IT WORKS</div>
          <h2>
            From local conditions
            <br />
            to <em>your next step.</em>
          </h2>
          <p>
            Recommendations are based on the air-quality information available for your selected place and reviewed
            general guidance. Your household preferences help us explain which options may fit. We show where data comes
            from and where it has limits.
          </p>
          <button type="button" className="text-link" onClick={onGetStarted}>
            Create your profile <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="how-steps">
          {[
            ['01', 'Check local conditions', 'See the available data, its timestamp, and whether it’s an observation or model estimate.'],
            ['02', 'Tell us what works', 'Add optional household and routine details to make suggestions more relevant.'],
            ['03', 'Choose your next step', 'Review practical actions and understand their personal or environmental impact.'],
          ].map(([num, title, desc]) => (
            <div key={num}>
              <span>{num}</span>
              <div>
                <strong>{title}</strong>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <div className="eyebrow">A CALMER WAY TO PLAN YOUR DAY</div>
          <h2>
            Make the next choice <em>a little clearer.</em>
          </h2>
        </div>
        <button type="button" className="primary-button" onClick={onGetStarted}>
          Get started <ArrowRight size={15} aria-hidden="true" />
        </button>
      </section>
    </>
  );
}
