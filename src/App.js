import './App.css';

import React from 'react';

import { createMuiTheme, responsiveFontSizes, ThemeProvider } from '@material-ui/core/styles';

import Container from '@material-ui/core/Container';
import CssBaseline from '@material-ui/core/CssBaseline';
import Grid from '@material-ui/core/Grid';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';


import GitHubIcon from '@material-ui/icons/GitHub';
import MailIcon from '@material-ui/icons/Mail';
import PhoneAndroidIcon from '@material-ui/icons/PhoneAndroid';
import TwitterIcon from '@material-ui/icons/Twitter';
import LinkedInIcon from '@material-ui/icons/LinkedIn';
import AccountBalanceIcon from '@material-ui/icons/AccountBalance';

import {Section, Entry, Experience, Github} from './Components.js';


function Photo({...props}) {
    return (
        <img
          alt="Headshot in front of brick wall"
          src="./photo.jpeg"
          {...props}
        />
    );
}

function Header() {
    return (
        <Section>

          <Entry
            title={<Photo className="largePhoto" />}
          />

          <Entry
            title={
                <Typography variant="h3" component="h1">
                  Wannes Rombouts
                </Typography>
            }
            desc={
                <Typography variant="h5" component="span">
                  Python Expertise & Security<br />
                  Full Stack Freelance
                </Typography>
            }
            leftTitle={
                <Photo className="smallPhoto" />
            }
          />

        </Section>
    );
}

function Contact() {
    return (
        <Section>

        <Grid container>

          <Grid container item xs={12} sm={1}>
          </Grid>

          <Grid container item xs={12} sm={6}>
            <Entry inline
              icon={<PhoneAndroidIcon fontSize="small" />}
              title={<Link href="tel:+33645297604">(+33) 06 45 29 76 04</Link>}
            />
            <Entry inline
              icon={<MailIcon fontSize="small" />}
              title={<Link href="mailto:wapiflapi+cv@gmail.com">wapiflapi@gmail.com</Link>}
            />
            <Entry inline
              icon={<AccountBalanceIcon fontSize="small" />}
              title={<Link href="https://www.malt.fr/profile/wapiflapi">malt.fr/profile/wapiflapi</Link>}
            />
          </Grid>

          <Grid container item xs={12} sm={5}>
            <Entry inline
              icon={<LinkedInIcon fontSize="small" />}
              title={<Link href="https://www.linkedin.com/in/wapiflapi/">linkedin.com/in/wapiflapi</Link>}
            />
            <Entry inline
              icon={<TwitterIcon fontSize="small" />}
              title={<Link href="https:twitter.com/wapiflapi">twitter.com/wapiflapi</Link>}
            />
            <Entry inline
              icon={<GitHubIcon fontSize="small" />}
              title={<Link href="https:github.com/wapiflapi">github.com/wapiflapi</Link>}
            />
          </Grid>

        </Grid>
        </Section>
    );
}

function Skills() {
    return (
        <Section title="Skills">
          <Experience
            date="Languages"
            title="French, English, Dutch"
            at="trilingual"
          />

          <Experience
            date="Soft Skills"
            title="Creative, Critical Thinking"
            at="Scrum Master"
          >
            Open Source contributor, Workshops,
            Conferences, Teaching, Code Reviews
          </Experience>

          <Experience
            date="Dev"
            title="Expertise in Python & GraphQL"
            at="REST, NodeJS, React"
          >
            Django, Flask, FastAPI, Graphene, Ariadne, DataLoader<br/>
            Redis, Mongo, PostgreSQL, C/C++, PHP, Go, Rust, Java
          </Experience>

          <Experience
            date="DevOps"
            title="CI/CD"
            at="AWS, Azure, GCP"
          >
            GitHub, GitLab, Docker, Kubernetes, Helm
          </Experience>

          <Experience
            date="Fundamentals"
            title="Algorithms, Data Structures"
            at="System Architecture"
          >
            Networks, Databases, Distributed Systems, Operating Systems
          </Experience>

          <Experience
            date="Security"
            title="Reverse Engineering"
            at="Exploit writing, Vulnerability discovery, Memory corruptions"
          >
            IDA Pro, Ghidra, GDB,
            Fuzzers - targeting Linux Kernel, libc, web, networks
          </Experience>

          <Experience
            date="Crypto"
            title="Blockchain, EVM"
            at="devp2p, RLPx"
          />

        </Section>
    );
}

function Work() {
    return (
        <Section title="Experience">

          <Experience
            date="2019 - present"
            title="Tech & Strategy Consultant"
            at="freelance"
          >
            I started sharing what I learned with teams facing similar
            issues. Working pro-bono with multiple early-stage
            startups I started as a freelance consultant. Challenging
            and helping teams identify growing problems early-on so
            they can focus on what to fix quickly to get the most
            value out of their time.
          </Experience>

          <Experience
            date="2018 - present"
            title="Event coordinator & creative writer"
            at="volunteer"
          >
            Runs a biweekly social event for collaborative
            story-telling. Facilitates narrative generation and
            individual expression by creating a safe and inviting
            environement. I run a d&d game.
          </Experience>

          <Experience
            date="Apr. 2019 - Oct. 2019"
            title="Tech Lead"
            at="Pepino"
          >
            I joined the project full time to lead the work on a new
            version of the app. Being involved in business and market
            strategy decisions, seting up infrastructure and building
            the software using agile and user-centric
            methods.
          </Experience>

          <Experience
            date="Apr. 2015 - Oct. 2018"
            title="Head of R&D"
            at="CityMeo (now Cenareo)"
          >
            Having joined as the first tech employee I have helped
            Cenareo.com (exCityMeo) through the challenges of growing
            from five to 30+ colleagues and friends solving the
            problems of scaling digit signage and enabling users to
            push content to thousands of connected screens across the
            world. When introducing agile methodologies I took on the
            role of Scrum Master. As a tech lead I have worked on
            restructuring a monolith into micro services and
            contributing to the open source python and graphql
            ecosystem. While head of R&D I had the opportunity to work
            on innovative algorithms but also improve our internal
            training, tooling and culture.
          </Experience>

          <Experience
            date="2011 - 2015"
            title="Founder & Manager"
            at="Epitech Toulouse Security Lab"
          >
            With a team of interested students we organised events,
            supervised projects and taught courses around computer
            security. I coordinated with the school and managed the
            club. We qualified for national and international
            competitions.
          </Experience>

          <Experience
            date="Sep. 2014 - Feb. 2015"
            title="Security Consultant"
            at="part-time at Neogeo Technologies"
          >
            I assessed and help increase the security standards of our
            clients' web applications by performing audits and
            penetration tests."
          </Experience>

          <Experience
            date="May - August 2013"
            title="Lead Python Developer"
            at="intern at Neogeo Technologies"
          >
            I worked on geographic information systems. I designed and
            implemented an API for managing MapServer's configuration
            and used it for a PyQT GUI plugin for QGIS
          </Experience>

          <Experience
            date="2013"
            title="C & Embedded Engineer"
            at="Airbus Innovation Cell"
          >
            Through a partnership with Epitech, I worked with Airbus
            engineers on prototyping distributed architectures using
            embedded hardware.
          </Experience>

          <Experience
            date="2011 - 2013"
            title="Teaching Assistant"
            at="Epitech"
          >
            I mentored students, helping them discover new methods and
            techniques. I also supervised practical work and
            participated in the assessment process.
          </Experience>

          <Experience
            date="Jun. - Sep. 2011"
            title="Python Developer"
            at="intern at ITrust"
          >
            I wrote a plugin for a monitoring platform for evaluating
            the quality of user experience on websites. I used Python
            and Selenium.
          </Experience>

        </Section>
    );
}


function Education() {
    return (
        <Section title="Education">
          <Experience
            date="2015"
            title="Master of Information Technology"
            description="Epitech, Paris Graduate School of Digital Innovation, France"
          />
          <Experience
            date="2014"
            title="Master of Sc. in Computer Security with Distinction"
            description="University of Kent at Canterbury, UK"
          />
          <Experience
            date="2013"
            title="Bachelor of Information Technology"
            description="Epitech, European Institute of Information Technology"
          />
        </Section>
    );
}


function Software() {
    return (
        <Section title="Open Source">
          <Github
            name="admiral"
            users="10k+"
          >
            Modules for VCV Rack, a virtual euro-rack synthesizer,
            exploring real-time digital sound processing technology.
          </Github>
          <Github
            name="binglide"
            stars="564"
            forks="75"
          >
            A visual reverse engineering tool I wrote as part of my
            ressearch project at the University of Kent. Introduced
            new techniques into the open-source community.
          </Github>
          <Github
            name="villoc"
            stars="512"
            forks="67"
          >
            A heap visualisation tool used during exploitation of
            memory corruptions, written duriong a CTF competition,
            this project has seen a lot of growth and contributions
            from the community that is using it.
          </Github>
          <Github
            name="exrs"
            stars="370"
            forks="60"
          >
            A collection of exercises that form a journey from a very
            first introduction to reverse engineering and binary
            exploitation to state of the art techniques. EXRS is used
            in several schools and computer security clubs.
          </Github>
          <Github
            name="gxf"
            stars="37"
            forks="7"
          >
            An extension framework and a collection of plugins for the
            GNU Project Debugger (gdb), at first a tool for my own use
            it became a way to explore gdb internals and provide
            utility to other security engineers.
          </Github>
        </Section>
    );
}


function Publications() {
    return (
        <Section title="Publications">

          <Experience
            date="Dec. 2019"
            title="GraphQL ecosystem in Python, comparing the different implementations."
            at="Python meet-up Toulouse"
          >
            Discussion about the internals of state of the art python
            implementation of GraphQL and comparisons Javascript.
          </Experience>

          <Experience
            date="Nov. 2019"
            title="Intro to Cache Attacks & Side Channels."
            at="Epitech open days"
          >
            An introduction for the general public to a very complex topic,
            giving a glimpse into advanced exploitation of internet vulnerabilities.
          </Experience>

          <Experience
            date="May 2019"
            title="EXMCISC: Learning CISC microcode and hacking together privilege levels"
            at="Toulouse Rootcamp 2019"
          >
            Designed and presented a CPU with minimal CISC capabilities.
            <a href="https://github.com/wapiflapi/exmcisc">
              github.com/wapiflapi/<strong>exmcisc</strong>
            </a>
          </Experience>

          <Experience
            date="Oct. 2019"
            title="Efficiency: Reverse Engineering with ghidra"
            at="blog post"
          >
            An introduction to some of Ghidra's feature, the reverse
            engineering software being new at the time.
          </Experience>

          <Experience
            date="Apr. 2015"
            title="Visualizing a single null-byte heap overflow exploitation"
            at="blog post"
          >
            Building on work by Project Zero this article shows how to
            exploit a specific vulnerability and introduces a tool
            (villoc) to facilitate the analysis.
          </Experience>

          <Experience
            date="Nov. 2014"
            title="Hack.lu's OREO with ret2dl-resolve"
            at="blog post"
          >
            I explored dynamic linking and how it can be turned into
            primitives for building reliable exploits.
          </Experience>

          <Experience
            date="Aug. 2014"
            title="Implementing Tools for Visual Reverse Engineering"
            at="dissertation at Kent University"
          >
            Outlines the development of binglide and presents research
            breaking some interactive flash CAPTCHAs.
          </Experience>

          <Experience
            date="Apr. 2014"
            title="Getting a shell on fruits - bkpctf 2014"
            at="blog post"
          >
            Exploiting a CTF binary to get a shell instead of the
            simple info leak that was intended. Required finding
            interesting gadgets in libc.
          </Experience>

          <Experience
            date="Apr 2013"
            title="A python's escape from PlaidCTF jail"
            at="Toulouse Rootcamp 2019"
          >
            Escape from a python jail setup with very strong
            restrictions on the inputs.  This article has been
            referenced by many other writeups for later challenges.
          </Experience>

        </Section>
    );
}


const theme = responsiveFontSizes(createMuiTheme());

export default function App() {
    return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Container maxWidth="md">

            <Header />
            <Contact />
            <Skills />
            <Work />
            <Education />

            <div className="newpage" />

            <Software />
            <Publications />
          </Container>
        </ThemeProvider>
    );

}
