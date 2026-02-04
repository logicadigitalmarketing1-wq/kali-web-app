import { PrismaClient, Role, Severity, AgentType } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await argon2.hash('admin123!@#', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@hexstrike.local' },
    update: {},
    create: {
      email: 'admin@hexstrike.local',
      name: 'Admin User',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create default scope (localhost only)
  const defaultScope = await prisma.scope.upsert({
    where: { name: 'localhost' },
    update: {},
    create: {
      name: 'localhost',
      description: 'Local development scope',
      cidrs: ['127.0.0.1/32', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
      hosts: ['localhost', '*.local', '*.test'],
      isActive: true,
    },
  });

  // Assign scope to admin
  await prisma.userScope.upsert({
    where: { userId_scopeId: { userId: admin.id, scopeId: defaultScope.id } },
    update: {},
    create: { userId: admin.id, scopeId: defaultScope.id },
  });
  console.log('✅ Created default scope and assigned to admin');

  // Create tool categories
  const categories = [
    // Network Categories
    { name: 'Network Reconnaissance', slug: 'network', description: 'Network discovery, port scanning, and service enumeration', icon: '🌐', sortOrder: 1 },
    { name: 'Local Network', slug: 'local-network', description: 'Internal network scanning, LAN discovery, ARP scanning, and lateral movement detection', icon: '🏠', sortOrder: 2 },
    { name: 'External Network', slug: 'external-network', description: 'External reconnaissance, internet-facing asset discovery, and perimeter testing', icon: '🌍', sortOrder: 3 },

    // Web & Application Security
    { name: 'Web Security', slug: 'web', description: 'Web application security testing and vulnerability assessment', icon: '🕸️', sortOrder: 4 },
    { name: 'API Security', slug: 'api', description: 'API security testing, GraphQL, JWT, and REST assessment', icon: '🔗', sortOrder: 5 },
    { name: 'Database Security', slug: 'database', description: 'Database vulnerability scanning, SQL injection, and database enumeration for MySQL, PostgreSQL, MongoDB, MSSQL, Oracle', icon: '🗄️', sortOrder: 6 },

    // Cloud Security (Granular)
    { name: 'AWS Security', slug: 'aws', description: 'Amazon Web Services security assessment, IAM auditing, S3 bucket analysis, and AWS-specific vulnerability scanning', icon: '🟠', sortOrder: 7 },
    { name: 'Azure Security', slug: 'azure', description: 'Microsoft Azure security assessment, Azure AD auditing, blob storage analysis, and Azure-specific vulnerability scanning', icon: '🔵', sortOrder: 8 },
    { name: 'GCP Security', slug: 'gcp', description: 'Google Cloud Platform security assessment, GCP IAM auditing, storage bucket analysis, and GCP-specific vulnerability scanning', icon: '🔴', sortOrder: 9 },
    { name: 'Cloud & Container', slug: 'cloud', description: 'Multi-cloud security assessment, container vulnerability scanning, and Kubernetes security', icon: '☁️', sortOrder: 10 },

    // Identity & Access
    { name: 'Active Directory', slug: 'active-directory', description: 'Active Directory enumeration, LDAP reconnaissance, Kerberos attacks, and Windows domain security testing', icon: '🏢', sortOrder: 11 },
    { name: 'Password & Auth', slug: 'password', description: 'Password cracking, hash analysis, and authentication testing', icon: '🔐', sortOrder: 12 },

    // Wireless
    { name: 'Wireless Security', slug: 'wireless', description: 'WiFi security testing, WPA/WPA2 cracking, wireless network reconnaissance, and rogue AP detection', icon: '📡', sortOrder: 13 },

    // Vulnerability & Exploitation
    { name: 'Vulnerability Scanning', slug: 'vuln', description: 'Automated vulnerability detection and CVE assessment', icon: '🔍', sortOrder: 14 },
    { name: 'Exploitation', slug: 'exploit', description: 'Exploitation frameworks and payload generation', icon: '💥', sortOrder: 15 },

    // Reconnaissance & Intelligence
    { name: 'OSINT & Recon', slug: 'osint', description: 'Open source intelligence and reconnaissance gathering', icon: '🕵️', sortOrder: 16 },

    // Analysis & Forensics
    { name: 'Binary Analysis', slug: 'binary', description: 'Binary analysis, reverse engineering, and exploit development', icon: '⚙️', sortOrder: 17 },
    { name: 'Forensics & CTF', slug: 'forensics', description: 'Digital forensics, file recovery, and CTF tools', icon: '🔬', sortOrder: 18 },
  ];

  for (const cat of categories) {
    await prisma.toolCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }
  console.log('✅ Created tool categories');

  // Create tools with manifests - comprehensive definitions with all parameters
  const tools = [
    // ==================== NETWORK SCANNING ====================
    {
      name: 'Nmap',
      slug: 'nmap',
      description: 'Nmap (Network Mapper) is a powerful open-source tool for network discovery and security auditing. It can discover hosts, services, operating systems, and vulnerabilities on computer networks. Essential for penetration testing and network inventory.',
      category: 'network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'nmap',
        argsSchema: {
          type: 'object',
          properties: {
            ports: {
              type: 'string',
              description: 'Port specification. Examples: "22", "1-1000", "22,80,443", "U:53,T:21-25,80"',
              default: '1-1000'
            },
            scanType: {
              type: 'string',
              enum: ['-sS', '-sT', '-sV', '-sU', '-sA', '-sN'],
              enumLabels: ['SYN Stealth (-sS)', 'TCP Connect (-sT)', 'Version Detection (-sV)', 'UDP Scan (-sU)', 'ACK Scan (-sA)', 'NULL Scan (-sN)'],
              description: 'Type of scan to perform. SYN is fastest and stealthy, TCP Connect is reliable, Version detects services',
              default: '-sV'
            },
            timing: {
              type: 'string',
              enum: ['-T0', '-T1', '-T2', '-T3', '-T4', '-T5'],
              enumLabels: ['Paranoid (T0)', 'Sneaky (T1)', 'Polite (T2)', 'Normal (T3)', 'Aggressive (T4)', 'Insane (T5)'],
              description: 'Timing template - higher is faster but more detectable. T3 is balanced, T4 is recommended for fast networks',
              default: '-T3'
            },
            osDetection: {
              type: 'boolean',
              description: 'Enable OS detection (-O). Attempts to identify the operating system of target hosts',
              default: false
            },
            scripts: {
              type: 'string',
              description: 'NSE scripts to run. Examples: "default", "vuln", "auth", "discovery". Use comma for multiple'
            },
            aggressive: {
              type: 'boolean',
              description: 'Enable aggressive scan (-A). Includes OS detection, version detection, script scanning, and traceroute',
              default: false
            },
            topPorts: {
              type: 'number',
              description: 'Scan top N most common ports instead of specifying port range',
            },
            excludePorts: {
              type: 'string',
              description: 'Ports to exclude from scan. Example: "22,80,443"'
            },
          },
        },
        commandTemplate: ['nmap', '{{scanType}}', '{{timing}}', '-p', '{{ports}}', '{{target}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Masscan',
      slug: 'masscan',
      description: 'Masscan is the fastest Internet port scanner. It can scan the entire Internet in under 5 minutes, transmitting 10 million packets per second. Useful for large-scale network reconnaissance and asset discovery.',
      category: 'network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'masscan',
        argsSchema: {
          type: 'object',
          properties: {
            ports: {
              type: 'string',
              description: 'Ports to scan. Examples: "80", "0-65535", "22,80,443,8080"',
              default: '1-1000'
            },
            rate: {
              type: 'number',
              description: 'Packets per second transmission rate. Higher = faster but may miss results. 10000 is aggressive',
              default: 1000
            },
            banners: {
              type: 'boolean',
              description: 'Grab banners from discovered services to identify versions',
              default: false
            },
            excludeFile: {
              type: 'string',
              description: 'File containing IP addresses/ranges to exclude from scanning'
            },
            adapter: {
              type: 'string',
              description: 'Network adapter to use for scanning (e.g., eth0, en0)'
            },
          },
        },
        commandTemplate: ['masscan', '-p', '{{ports}}', '--rate', '{{rate}}', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Rustscan',
      slug: 'rustscan',
      description: 'RustScan is a modern, fast port scanner written in Rust. It combines speed with Nmap integration - first quickly finds open ports, then passes them to Nmap for detailed scanning.',
      category: 'network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'rustscan',
        argsSchema: {
          type: 'object',
          properties: {
            ports: {
              type: 'string',
              description: 'Ports to scan. Use "-" for all ports (1-65535). Examples: "80,443" or "1-1000"',
            },
            batchSize: {
              type: 'number',
              description: 'Number of ports to scan at once. Higher = faster but may overwhelm target',
              default: 4500
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds for port connections',
              default: 1500
            },
            ulimit: {
              type: 'number',
              description: 'Maximum file descriptors to use',
              default: 5000
            },
            nmapArgs: {
              type: 'string',
              description: 'Additional arguments to pass to Nmap after discovery. Example: "-sV -sC"'
            },
          },
        },
        commandTemplate: ['rustscan', '-a', '{{target}}', '--ulimit', '{{ulimit}}', '-b', '{{batchSize}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'ARP-Scan',
      slug: 'arp-scan',
      description: 'ARP-scan sends ARP packets to discover hosts on a local network segment. More reliable than ping for host discovery on LANs as it works at Layer 2 and bypasses firewalls.',
      category: 'network',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'arp-scan',
        argsSchema: {
          type: 'object',
          properties: {
            interface: {
              type: 'string',
              description: 'Network interface to use (e.g., eth0, en0, wlan0)'
            },
            localnet: {
              type: 'boolean',
              description: 'Scan all IP addresses on the local network',
              default: true
            },
            retry: {
              type: 'number',
              description: 'Number of retries per host',
              default: 2
            },
          },
        },
        commandTemplate: ['arp-scan', '--localnet', '{{target}}'],
        timeout: 120,
        memoryLimit: 128,
      },
    },

    // ==================== WEB SECURITY ====================
    {
      name: 'Gobuster',
      slug: 'gobuster',
      description: 'Gobuster is a directory/file & DNS busting tool written in Go. It brute-forces URIs, DNS subdomains, virtual hostnames, and S3 buckets. Fast and supports multiple modes.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'gobuster',
        argsSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['dir', 'dns', 'vhost', 's3', 'fuzz'],
              enumLabels: ['Directory/File', 'DNS Subdomain', 'Virtual Host', 'S3 Bucket', 'Fuzzing'],
              description: 'Scanning mode. Dir for web paths, DNS for subdomains, VHost for virtual hosts',
              default: 'dir'
            },
            wordlist: {
              type: 'string',
              description: 'Path to wordlist file. Common lists: /usr/share/wordlists/dirb/common.txt, /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt',
              default: '/usr/share/wordlists/dirb/common.txt'
            },
            threads: {
              type: 'number',
              description: 'Number of concurrent threads. Higher = faster but may trigger rate limits',
              default: 10
            },
            extensions: {
              type: 'string',
              description: 'File extensions to search for. Example: "php,html,js,txt,bak"'
            },
            statusCodes: {
              type: 'string',
              description: 'Status codes to include in results. Example: "200,204,301,302,307,401,403"',
              default: '200,204,301,302,307,401,403'
            },
            excludeLength: {
              type: 'string',
              description: 'Exclude responses with these content lengths (to filter false positives)'
            },
            followRedirect: {
              type: 'boolean',
              description: 'Follow HTTP redirects',
              default: false
            },
            noTlsValidation: {
              type: 'boolean',
              description: 'Skip TLS certificate verification for HTTPS targets',
              default: false
            },
            cookies: {
              type: 'string',
              description: 'Cookies to include with requests. Format: "name=value; name2=value2"'
            },
            headers: {
              type: 'string',
              description: 'Custom headers to include. Format: "Header: Value"'
            },
          },
        },
        commandTemplate: ['gobuster', '{{mode}}', '-u', '{{target}}', '-w', '{{wordlist}}', '-t', '{{threads}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Feroxbuster',
      slug: 'feroxbuster',
      description: 'Feroxbuster is a fast, recursive content discovery tool written in Rust. It automatically recurses into discovered directories, finding deeply nested content that other tools miss.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'feroxbuster',
        argsSchema: {
          type: 'object',
          properties: {
            wordlist: {
              type: 'string',
              description: 'Wordlist for directory/file discovery',
              default: '/usr/share/wordlists/dirb/common.txt'
            },
            threads: {
              type: 'number',
              description: 'Number of concurrent threads',
              default: 50
            },
            depth: {
              type: 'number',
              description: 'Maximum recursion depth. Set to 0 for infinite',
              default: 2
            },
            extensions: {
              type: 'string',
              description: 'File extensions to search. Example: "php,html,js,txt"'
            },
            statusCodes: {
              type: 'string',
              description: 'Status codes to include. Example: "200,204,301,302,307,401,403,500"'
            },
            timeout: {
              type: 'number',
              description: 'Request timeout in seconds',
              default: 7
            },
            dontFilter: {
              type: 'boolean',
              description: 'Disable auto-filtering of similar responses',
              default: false
            },
            extractLinks: {
              type: 'boolean',
              description: 'Extract links from response bodies and add to queue',
              default: true
            },
          },
        },
        commandTemplate: ['feroxbuster', '-u', '{{target}}', '-w', '{{wordlist}}', '-t', '{{threads}}', '-d', '{{depth}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Nikto',
      slug: 'nikto',
      description: 'Nikto is a comprehensive web server scanner that tests for dangerous files/CGIs, outdated server software, and other problems. It performs over 6700 tests against web servers.',
      category: 'web',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'nikto',
        argsSchema: {
          type: 'object',
          properties: {
            tuning: {
              type: 'string',
              enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'a', 'b', 'c', 'x'],
              enumLabels: [
                '1: Interesting File', '2: Misconfiguration', '3: Information Disclosure',
                '4: XSS/Script Injection', '5: Remote File Retrieval', '6: Denial of Service',
                '7: Remote File Retrieval (Server)', '8: Command Execution', '9: SQL Injection',
                '0: File Upload', 'a: Authentication Bypass', 'b: Software Identification',
                'c: Remote Source Inclusion', 'x: Reverse Tuning'
              ],
              description: 'Scan tuning to control which tests are performed'
            },
            ssl: {
              type: 'boolean',
              description: 'Force SSL mode for scanning HTTPS targets',
              default: false
            },
            maxTime: {
              type: 'string',
              description: 'Maximum scan time. Examples: "1h" (1 hour), "30m" (30 minutes)'
            },
            plugins: {
              type: 'string',
              description: 'Plugins to run. Use "list" to see available plugins'
            },
            evasion: {
              type: 'string',
              enum: ['1', '2', '3', '4', '5', '6', '7', '8'],
              enumLabels: [
                '1: Random URI encoding', '2: Directory self-reference',
                '3: Premature URL ending', '4: Prepend long random string',
                '5: Fake parameter', '6: TAB as request spacer',
                '7: Change case of URL', '8: Use Windows directory separator'
              ],
              description: 'IDS evasion technique to use'
            },
            userAgent: {
              type: 'string',
              description: 'Custom User-Agent string to use'
            },
          },
        },
        commandTemplate: ['nikto', '-h', '{{target}}', '-maxtime', '600', '-timeout', '10'],
        timeout: 900,
        memoryLimit: 256,
      },
    },
    {
      name: 'SQLMap',
      slug: 'sqlmap',
      description: 'SQLMap is an automatic SQL injection and database takeover tool. It detects and exploits SQL injection flaws, supporting multiple database backends (MySQL, PostgreSQL, Oracle, MSSQL, etc).',
      category: 'web',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'sqlmap',
        argsSchema: {
          type: 'object',
          properties: {
            level: {
              type: 'number',
              enum: [1, 2, 3, 4, 5],
              description: 'Level of tests (1-5). Higher levels test more injection points. Level 1: basic, Level 5: comprehensive',
              default: 1
            },
            risk: {
              type: 'number',
              enum: [1, 2, 3],
              description: 'Risk of tests (1-3). Level 1: safe, Level 2: may cause heavy queries, Level 3: may modify data',
              default: 1
            },
            technique: {
              type: 'string',
              description: 'SQL injection techniques to use. B=Boolean-based, E=Error-based, U=Union, S=Stacked, T=Time-based, Q=Inline queries. Example: "BEUST"'
            },
            dbms: {
              type: 'string',
              enum: ['mysql', 'postgresql', 'oracle', 'mssql', 'sqlite', 'access', 'firebird'],
              description: 'Force back-end database type'
            },
            dbs: {
              type: 'boolean',
              description: 'Enumerate databases',
              default: false
            },
            tables: {
              type: 'boolean',
              description: 'Enumerate tables in database',
              default: false
            },
            dump: {
              type: 'boolean',
              description: 'Dump database table contents',
              default: false
            },
            osShell: {
              type: 'boolean',
              description: 'Attempt to get an interactive OS shell',
              default: false
            },
            threads: {
              type: 'number',
              description: 'Number of concurrent threads',
              default: 1
            },
            data: {
              type: 'string',
              description: 'POST data to test. Example: "username=test&password=test"'
            },
            cookie: {
              type: 'string',
              description: 'HTTP Cookie header value'
            },
            batch: {
              type: 'boolean',
              description: 'Run in batch mode (no user interaction, use defaults)',
              default: true
            },
          },
        },
        commandTemplate: ['sqlmap', '-u', '{{target}}', '--level', '{{level}}', '--risk', '{{risk}}', '--batch'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'WPScan',
      slug: 'wpscan',
      description: 'WPScan is a WordPress security scanner. It detects vulnerable plugins, themes, weak passwords, and security misconfigurations specific to WordPress installations.',
      category: 'web',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'wpscan',
        argsSchema: {
          type: 'object',
          properties: {
            enumerate: {
              type: 'string',
              enum: ['p', 'vp', 'ap', 't', 'vt', 'at', 'u', 'cb', 'dbe'],
              enumLabels: [
                'p: Popular plugins', 'vp: Vulnerable plugins', 'ap: All plugins',
                't: Popular themes', 'vt: Vulnerable themes', 'at: All themes',
                'u: Users', 'cb: Config backups', 'dbe: Database exports'
              ],
              description: 'What to enumerate. Can combine multiple: "vp,vt,u"',
              default: 'vp'
            },
            passwords: {
              type: 'string',
              description: 'Path to password list for brute force attack'
            },
            usernames: {
              type: 'string',
              description: 'Comma-separated list of usernames to brute force'
            },
            apiToken: {
              type: 'string',
              description: 'WPVulnDB API token for vulnerability data (optional)'
            },
            detection: {
              type: 'string',
              enum: ['mixed', 'passive', 'aggressive'],
              description: 'Detection mode. Passive is stealthier, aggressive is more thorough',
              default: 'mixed'
            },
            pluginsDetection: {
              type: 'string',
              enum: ['mixed', 'passive', 'aggressive'],
              description: 'Plugin detection mode',
              default: 'passive'
            },
            force: {
              type: 'boolean',
              description: 'Do not check if target is WordPress',
              default: false
            },
          },
        },
        commandTemplate: ['wpscan', '--url', '{{target}}', '-e', '{{enumerate}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    // ==================== VULNERABILITY SCANNING ====================
    {
      name: 'Nuclei',
      slug: 'nuclei',
      description: 'Nuclei is a fast, template-based vulnerability scanner. It uses YAML templates to send requests across targets and detect security issues. Community templates cover CVEs, misconfigurations, exposures, and more.',
      category: 'vuln',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'nuclei',
        argsSchema: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['info', 'low', 'medium', 'high', 'critical'],
              description: 'Filter templates by severity level. Multiple can be comma-separated',
            },
            tags: {
              type: 'string',
              description: 'Filter templates by tags. Examples: "cve", "xss", "sqli", "lfi", "rce", "misconfig". Comma-separate multiple'
            },
            templates: {
              type: 'string',
              description: 'Path to specific template or template directory to run'
            },
            excludeTags: {
              type: 'string',
              description: 'Tags to exclude from scan. Example: "dos,fuzzing"'
            },
            newTemplates: {
              type: 'boolean',
              description: 'Run only templates added in the latest nuclei-templates release',
              default: false
            },
            automaticScan: {
              type: 'boolean',
              description: 'Automatic scan mode based on wappalyzer technology detection',
              default: false
            },
            rateLimit: {
              type: 'number',
              description: 'Maximum requests per second to send',
              default: 150
            },
            concurrency: {
              type: 'number',
              description: 'Number of templates to run concurrently',
              default: 25
            },
            headless: {
              type: 'boolean',
              description: 'Enable headless browser-based templates for dynamic content',
              default: false
            },
          },
        },
        commandTemplate: ['nuclei', '-u', '{{target}}', '-duc'],
        timeout: 900,
        memoryLimit: 512,
      },
    },

    // ==================== PASSWORD & AUTHENTICATION ====================
    {
      name: 'Hydra',
      slug: 'hydra',
      description: 'Hydra is a fast and flexible network login cracker supporting numerous protocols. It performs rapid dictionary attacks against various services including SSH, FTP, HTTP, SMB, databases, and more.',
      category: 'password',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'hydra',
        argsSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              enum: ['ssh', 'ftp', 'http-get', 'http-post', 'http-form', 'smb', 'rdp', 'mysql', 'postgres', 'mssql', 'vnc', 'telnet', 'smtp', 'pop3', 'imap'],
              enumLabels: [
                'SSH', 'FTP', 'HTTP GET Auth', 'HTTP POST Auth', 'HTTP Form',
                'SMB/Windows', 'RDP', 'MySQL', 'PostgreSQL', 'MS SQL Server',
                'VNC', 'Telnet', 'SMTP', 'POP3', 'IMAP'
              ],
              description: 'Target service/protocol to attack',
              required: true
            },
            username: {
              type: 'string',
              description: 'Single username to test. Use -L for a username list file'
            },
            usernameList: {
              type: 'string',
              description: 'Path to file containing list of usernames (one per line)'
            },
            password: {
              type: 'string',
              description: 'Single password to test'
            },
            passwordList: {
              type: 'string',
              description: 'Path to password wordlist file. Common: /usr/share/wordlists/rockyou.txt',
              default: '/usr/share/wordlists/rockyou.txt'
            },
            threads: {
              type: 'number',
              description: 'Number of parallel connections per target. Too high may trigger lockouts',
              default: 16
            },
            port: {
              type: 'number',
              description: 'Custom port if service is not on default port'
            },
            ssl: {
              type: 'boolean',
              description: 'Use SSL/TLS connection',
              default: false
            },
            verbose: {
              type: 'boolean',
              description: 'Show login+pass for each attempt',
              default: false
            },
            exitOnSuccess: {
              type: 'boolean',
              description: 'Stop after first valid password found',
              default: true
            },
            waitTime: {
              type: 'number',
              description: 'Wait time between attempts in seconds (helps avoid lockouts)'
            },
          },
        },
        commandTemplate: ['hydra', '-l', '{{username}}', '-P', '{{passwordList}}', '-t', '{{threads}}', '{{target}}', '{{service}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'John the Ripper',
      slug: 'john',
      description: 'John the Ripper is a fast password cracker for detecting weak Unix passwords, Windows LM/NTLM hashes, and many other hash types. It supports dictionary attacks, brute force, and rule-based cracking.',
      category: 'password',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'john',
        argsSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['raw-md5', 'raw-sha1', 'raw-sha256', 'raw-sha512', 'bcrypt', 'md5crypt', 'sha512crypt', 'nt', 'lm', 'descrypt'],
              enumLabels: ['MD5', 'SHA1', 'SHA256', 'SHA512', 'bcrypt', 'MD5 Crypt', 'SHA512 Crypt', 'NTLM', 'LM', 'DES Crypt'],
              description: 'Hash format to crack. Use --list=formats for full list'
            },
            wordlist: {
              type: 'string',
              description: 'Path to wordlist file for dictionary attack',
              default: '/usr/share/wordlists/rockyou.txt'
            },
            rules: {
              type: 'string',
              description: 'Enable word mangling rules. Options: "Single", "Wordlist", "Extra", "Jumbo", "KoreLogic"'
            },
            incremental: {
              type: 'boolean',
              description: 'Use incremental (brute force) mode instead of dictionary',
              default: false
            },
            show: {
              type: 'boolean',
              description: 'Show previously cracked passwords instead of cracking',
              default: false
            },
            fork: {
              type: 'number',
              description: 'Number of parallel processes (CPU cores to use)'
            },
            minLength: {
              type: 'number',
              description: 'Minimum password length to try (for incremental mode)'
            },
            maxLength: {
              type: 'number',
              description: 'Maximum password length to try (for incremental mode)'
            },
          },
        },
        commandTemplate: ['john', '--format={{format}}', '--wordlist={{wordlist}}', '{{target}}'],
        timeout: 1800,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Hashcat',
      slug: 'hashcat',
      description: 'Hashcat is the world\'s fastest password recovery tool. It supports GPU acceleration and over 300 hash types. Ideal for high-performance password cracking.',
      category: 'password',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'hashcat',
        argsSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'number',
              description: 'Hash type mode number. Common: 0=MD5, 100=SHA1, 1400=SHA256, 1000=NTLM, 3200=bcrypt. Use --help for full list',
              required: true
            },
            attack: {
              type: 'number',
              enum: [0, 1, 3, 6, 7],
              enumLabels: ['Dictionary (0)', 'Combination (1)', 'Brute-force (3)', 'Hybrid Dict+Mask (6)', 'Hybrid Mask+Dict (7)'],
              description: 'Attack mode to use',
              default: 0
            },
            wordlist: {
              type: 'string',
              description: 'Wordlist file for dictionary/hybrid attacks',
              default: '/usr/share/wordlists/rockyou.txt'
            },
            rules: {
              type: 'string',
              description: 'Rule file for word mangling. Example: /usr/share/hashcat/rules/best64.rule'
            },
            mask: {
              type: 'string',
              description: 'Mask for brute-force. ?l=lowercase, ?u=uppercase, ?d=digit, ?s=special. Example: "?l?l?l?l?d?d"'
            },
            increment: {
              type: 'boolean',
              description: 'Enable mask increment mode (try shorter masks first)',
              default: false
            },
            incrementMin: {
              type: 'number',
              description: 'Start increment at this length'
            },
            incrementMax: {
              type: 'number',
              description: 'Stop increment at this length'
            },
            workload: {
              type: 'number',
              enum: [1, 2, 3, 4],
              enumLabels: ['Low (1)', 'Default (2)', 'High (3)', 'Nightmare (4)'],
              description: 'Workload profile. Higher = faster but uses more resources',
              default: 2
            },
          },
        },
        commandTemplate: ['hashcat', '-m', '{{mode}}', '-a', '{{attack}}', '{{target}}', '{{wordlist}}'],
        timeout: 3600,
        memoryLimit: 2048,
      },
    },

    // ==================== OSINT & RECONNAISSANCE ====================
    {
      name: 'Amass',
      slug: 'amass',
      description: 'OWASP Amass performs network mapping and external asset discovery using open source information gathering and active reconnaissance techniques. Excellent for finding subdomains and related infrastructure.',
      category: 'osint',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'amass',
        argsSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['enum', 'intel', 'viz', 'track', 'db'],
              enumLabels: ['Enumerate', 'Intelligence', 'Visualize', 'Track', 'Database'],
              description: 'Operation mode. Enum finds subdomains, Intel gathers intelligence about orgs',
              default: 'enum'
            },
            passive: {
              type: 'boolean',
              description: 'Use only passive data sources (no DNS queries to target)',
              default: true
            },
            active: {
              type: 'boolean',
              description: 'Enable active recon (DNS brute forcing, zone transfers)',
              default: false
            },
            bruteForce: {
              type: 'boolean',
              description: 'Enable DNS brute forcing for subdomain discovery',
              default: false
            },
            wordlist: {
              type: 'string',
              description: 'Wordlist for brute forcing subdomains'
            },
            timeout: {
              type: 'number',
              description: 'Number of minutes to run enumeration',
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum recursion depth for subdomain discovery',
              default: 2
            },
            ipv4: {
              type: 'boolean',
              description: 'Show IPv4 addresses for discovered names',
              default: true
            },
            ipv6: {
              type: 'boolean',
              description: 'Show IPv6 addresses for discovered names',
              default: false
            },
          },
        },
        commandTemplate: ['amass', 'enum', '-passive', '-d', '{{target}}', '-timeout', '10'],
        timeout: 900,
        memoryLimit: 512,
      },
    },
    {
      name: 'Subfinder',
      slug: 'subfinder',
      description: 'Subfinder is a subdomain discovery tool that returns valid subdomains for websites using passive online sources. It\'s fast, lightweight, and integrates with many APIs for comprehensive results.',
      category: 'osint',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'subfinder',
        argsSchema: {
          type: 'object',
          properties: {
            silent: {
              type: 'boolean',
              description: 'Show only subdomains in output',
              default: false
            },
            recursive: {
              type: 'boolean',
              description: 'Use recursion to find more subdomains',
              default: false
            },
            all: {
              type: 'boolean',
              description: 'Use all sources (slower but more comprehensive)',
              default: false
            },
            threads: {
              type: 'number',
              description: 'Number of concurrent threads',
              default: 10
            },
            timeout: {
              type: 'number',
              description: 'Timeout in seconds for each source',
              default: 30
            },
            maxEnumTime: {
              type: 'number',
              description: 'Maximum time in minutes for enumeration'
            },
            excludeSources: {
              type: 'string',
              description: 'Sources to exclude (comma-separated)'
            },
          },
        },
        commandTemplate: ['subfinder', '-d', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'theHarvester',
      slug: 'theharvester',
      description: 'theHarvester gathers emails, subdomains, hosts, employee names, open ports, and banners from different public sources. Essential for the information gathering phase of penetration testing.',
      category: 'osint',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'theHarvester',
        argsSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              enum: ['all', 'baidu', 'bing', 'bingapi', 'certspotter', 'crtsh', 'dnsdumpster', 'duckduckgo', 'github', 'google', 'hackertarget', 'hunter', 'linkedin', 'netcraft', 'securityTrails', 'shodan', 'twitter', 'virustotal', 'yahoo'],
              description: 'Data source to use. Use "all" for comprehensive search',
              default: 'all'
            },
            limit: {
              type: 'number',
              description: 'Limit the number of results from each source',
              default: 500
            },
            startPage: {
              type: 'number',
              description: 'Start searching from this page number',
              default: 0
            },
            shodan: {
              type: 'boolean',
              description: 'Use Shodan to query discovered hosts',
              default: false
            },
            dnsServer: {
              type: 'string',
              description: 'Custom DNS server to use for resolution'
            },
            screenshot: {
              type: 'boolean',
              description: 'Take screenshots of discovered subdomains',
              default: false
            },
          },
        },
        commandTemplate: ['theHarvester', '-d', '{{target}}', '-b', '{{source}}', '-l', '{{limit}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },

    // ==================== BINARY ANALYSIS ====================
    {
      name: 'Binwalk',
      slug: 'binwalk',
      description: 'Binwalk is a firmware analysis tool for analyzing, reverse engineering, and extracting data from binary files. It can identify embedded files, compressed archives, and executable code within firmware images. Essential for IoT security research and firmware reverse engineering.',
      category: 'binary',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'binwalk',
        argsSchema: {
          type: 'object',
          properties: {
            extract: {
              type: 'boolean',
              description: 'Automatically extract known file types from the target firmware',
              default: false
            },
            entropy: {
              type: 'boolean',
              description: 'Calculate file entropy to detect compressed or encrypted sections. Useful for identifying packed/encrypted regions',
              default: false
            },
            signature: {
              type: 'boolean',
              description: 'Scan for file signatures (magic bytes) to identify embedded file types',
              default: true
            },
            matryoshka: {
              type: 'boolean',
              description: 'Recursively extract files from extracted files (nested extraction)',
              default: false
            },
            depth: {
              type: 'number',
              description: 'Maximum recursion depth for matryoshka extraction',
              default: 8
            },
            quiet: {
              type: 'boolean',
              description: 'Suppress output messages',
              default: false
            },
            raw: {
              type: 'boolean',
              description: 'Extract unknown file types (raw extraction)',
              default: false
            },
            carve: {
              type: 'boolean',
              description: 'Carve data from file rather than extract (better for damaged files)',
              default: false
            },
          },
        },
        commandTemplate: ['binwalk', '{{target}}'],
        timeout: 300,
        memoryLimit: 512,
      },
    },
    {
      name: 'Checksec',
      slug: 'checksec',
      description: 'Checksec analyzes ELF binaries and processes for security features. It checks for RELRO, Stack Canaries, NX/DEP, PIE, RPATH/RUNPATH, and Fortify. Essential for binary exploitation research to identify potential attack vectors.',
      category: 'binary',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'checksec',
        argsSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['cli', 'csv', 'json', 'xml'],
              enumLabels: ['CLI (colored)', 'CSV', 'JSON', 'XML'],
              description: 'Output format for the results',
              default: 'cli'
            },
            extended: {
              type: 'boolean',
              description: 'Show extended information including security features explanation',
              default: false
            },
            fortifyFile: {
              type: 'boolean',
              description: 'Check for Fortify Source functions in binary',
              default: true
            },
            kernel: {
              type: 'boolean',
              description: 'Check kernel security settings instead of binary',
              default: false
            },
            proc: {
              type: 'string',
              description: 'Process name or PID to check instead of file'
            },
            procAll: {
              type: 'boolean',
              description: 'Check all running processes',
              default: false
            },
          },
        },
        commandTemplate: ['checksec', '--file', '{{target}}'],
        timeout: 60,
        memoryLimit: 128,
      },
    },
    {
      name: 'Strings',
      slug: 'strings',
      description: 'Strings extracts printable character sequences from binary files. Useful for finding hardcoded credentials, URLs, error messages, file paths, and other interesting data embedded in executables and firmware.',
      category: 'binary',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'strings',
        argsSchema: {
          type: 'object',
          properties: {
            minLength: {
              type: 'number',
              description: 'Minimum string length to extract (default is 4 characters)',
              default: 4
            },
            encoding: {
              type: 'string',
              enum: ['s', 'S', 'b', 'l', 'B', 'L'],
              enumLabels: ['7-bit ASCII (s)', '8-bit (S)', '16-bit Big Endian (b)', '16-bit Little Endian (l)', '32-bit Big Endian (B)', '32-bit Little Endian (L)'],
              description: 'Character encoding to search for. Use "l" for Windows binaries (UTF-16 LE)',
              default: 's'
            },
            all: {
              type: 'boolean',
              description: 'Scan entire file, not just data sections',
              default: false
            },
            radix: {
              type: 'string',
              enum: ['o', 'd', 'x'],
              enumLabels: ['Octal (o)', 'Decimal (d)', 'Hexadecimal (x)'],
              description: 'Print string offset in specified radix'
            },
            includeAllWhitespace: {
              type: 'boolean',
              description: 'Include all whitespace as valid string characters',
              default: false
            },
          },
        },
        commandTemplate: ['strings', '-n', '{{minLength}}', '{{target}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    // ==================== FORENSICS ====================
    {
      name: 'Foremost',
      slug: 'foremost',
      description: 'Foremost is a data recovery and file carving tool that recovers files based on their headers, footers, and internal data structures. It can recover files from disk images, raw drives, and forensic images. Commonly used in digital forensics to recover deleted files.',
      category: 'forensics',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'foremost',
        argsSchema: {
          type: 'object',
          properties: {
            types: {
              type: 'string',
              description: 'File types to recover. Options: jpg, gif, png, bmp, avi, exe, mpg, wav, riff, wmv, mov, pdf, ole, doc, zip, rar, htm, cpp. Comma-separated for multiple',
              default: 'all'
            },
            verbose: {
              type: 'boolean',
              description: 'Enable verbose mode with logging of all files extracted',
              default: false
            },
            quiet: {
              type: 'boolean',
              description: 'Quiet mode - only display errors and finish message',
              default: false
            },
            indirect: {
              type: 'boolean',
              description: 'Indirect block detection for UNIX file systems',
              default: false
            },
            quick: {
              type: 'boolean',
              description: 'Quick mode - search only first 10MB for headers',
              default: false
            },
            allHeaders: {
              type: 'boolean',
              description: 'Write all headers, perform no error detection (corrupted files)',
              default: false
            },
          },
        },
        commandTemplate: ['foremost', '-i', '{{target}}', '-o', '/tmp/foremost-output'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Steghide',
      slug: 'steghide',
      description: 'Steghide is a steganography tool that can hide and extract data from JPEG, BMP, WAV, and AU files. It uses a graph-theoretic approach for embedding and supports encryption. Useful for forensic analysis to detect hidden data in media files.',
      category: 'forensics',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'steghide',
        argsSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['info', 'extract'],
              enumLabels: ['Info (analyze)', 'Extract (retrieve hidden data)'],
              description: 'Action to perform. Info shows file capacity, Extract retrieves hidden data',
              default: 'info'
            },
            passphrase: {
              type: 'string',
              description: 'Passphrase for encryption/decryption of hidden data'
            },
            force: {
              type: 'boolean',
              description: 'Force overwrite of existing files',
              default: false
            },
            compression: {
              type: 'number',
              enum: [1, 2, 3, 4, 5, 6, 7, 8, 9],
              description: 'Compression level (1=fast, 9=best compression)',
              default: 9
            },
            encryption: {
              type: 'string',
              enum: ['none', 'aes128', 'aes192', 'aes256', 'des', '3des', 'cast128', 'blowfish', 'twofish'],
              description: 'Encryption algorithm for hiding data',
              default: 'aes128'
            },
          },
        },
        commandTemplate: ['steghide', '{{action}}', '-sf', '{{target}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'ExifTool',
      slug: 'exiftool',
      description: 'ExifTool is a powerful metadata reader/writer supporting EXIF, GPS, IPTC, XMP, JFIF, and more in images, audio, video, and PDF files. Invaluable for forensics to extract timestamps, GPS coordinates, camera info, and editing history from media files.',
      category: 'forensics',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'exiftool',
        argsSchema: {
          type: 'object',
          properties: {
            all: {
              type: 'boolean',
              description: 'Extract all metadata tags including duplicates',
              default: true
            },
            gps: {
              type: 'boolean',
              description: 'Extract only GPS/geolocation information',
              default: false
            },
            common: {
              type: 'boolean',
              description: 'Show only common metadata tags',
              default: false
            },
            verbose: {
              type: 'boolean',
              description: 'Verbose output with raw tag values',
              default: false
            },
            json: {
              type: 'boolean',
              description: 'Output in JSON format',
              default: false
            },
            groupHeadings: {
              type: 'boolean',
              description: 'Organize output by metadata group (EXIF, IPTC, XMP, etc.)',
              default: false
            },
            extractThumbnail: {
              type: 'boolean',
              description: 'Extract embedded thumbnail image to separate file',
              default: false
            },
            unknown: {
              type: 'boolean',
              description: 'Show unknown/proprietary tags',
              default: false
            },
          },
        },
        commandTemplate: ['exiftool', '{{target}}'],
        timeout: 60,
        memoryLimit: 128,
      },
    },
    // ==================== ADDITIONAL WEB TOOLS ====================
    {
      name: 'Dirb',
      slug: 'dirb',
      description: 'DIRB is a web content scanner that brute forces directories and files on web servers using dictionary-based attacks. It\'s a classic tool for discovering hidden resources, backup files, and admin panels.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'dirb',
        argsSchema: {
          type: 'object',
          properties: {
            wordlist: {
              type: 'string',
              description: 'Wordlist file path. Common lists: /usr/share/dirb/wordlists/common.txt, /usr/share/dirb/wordlists/big.txt',
              default: '/usr/share/dirb/wordlists/common.txt'
            },
            extensions: {
              type: 'string',
              description: 'Extensions to append to each word. Example: ".php,.html,.txt"'
            },
            userAgent: {
              type: 'string',
              description: 'Custom User-Agent string to use'
            },
            cookie: {
              type: 'string',
              description: 'Cookie string to include with requests'
            },
            httpAuth: {
              type: 'string',
              description: 'HTTP Basic authentication (user:password)'
            },
            proxy: {
              type: 'string',
              description: 'Proxy to use. Format: http://host:port'
            },
            notRecursive: {
              type: 'boolean',
              description: 'Disable recursive scanning (don\'t enter found directories)',
              default: false
            },
            caseInsensitive: {
              type: 'boolean',
              description: 'Use case-insensitive search',
              default: false
            },
            notStopWarnPages: {
              type: 'boolean',
              description: 'Don\'t stop on warning pages (directory listings)',
              default: false
            },
            speed: {
              type: 'number',
              description: 'Delay in milliseconds between requests (throttling)',
              default: 0
            },
          },
        },
        commandTemplate: ['dirb', '{{target}}', '{{wordlist}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Dirsearch',
      slug: 'dirsearch',
      description: 'Dirsearch is a mature command-line web path discovery tool. It\'s designed to brute force directories and files in web servers with smart wordlist support, multiple extensions, and intelligent filtering.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'dirsearch',
        argsSchema: {
          type: 'object',
          properties: {
            extensions: {
              type: 'string',
              description: 'File extensions to search. Example: "php,html,js,txt,bak"',
              default: 'php,html,js'
            },
            threads: {
              type: 'number',
              description: 'Number of concurrent threads',
              default: 20
            },
            wordlist: {
              type: 'string',
              description: 'Custom wordlist path (uses built-in by default)'
            },
            recursive: {
              type: 'boolean',
              description: 'Enable recursive scanning of found directories',
              default: false
            },
            recursionDepth: {
              type: 'number',
              description: 'Maximum recursion depth',
              default: 2
            },
            excludeStatusCodes: {
              type: 'string',
              description: 'Exclude responses with these status codes. Example: "400,403,500"'
            },
            includeStatusCodes: {
              type: 'string',
              description: 'Include only responses with these status codes. Example: "200,301,302"'
            },
            randomAgent: {
              type: 'boolean',
              description: 'Use randomly selected User-Agents',
              default: false
            },
            delay: {
              type: 'number',
              description: 'Delay in seconds between requests (to avoid rate limiting)'
            },
            timeout: {
              type: 'number',
              description: 'Connection timeout in seconds',
              default: 20
            },
            proxy: {
              type: 'string',
              description: 'Proxy URL (e.g., http://127.0.0.1:8080)'
            },
            headers: {
              type: 'string',
              description: 'Custom headers. Format: "Header1: value1\\nHeader2: value2"'
            },
            cookie: {
              type: 'string',
              description: 'Cookie string to include with requests'
            },
            forceExtensions: {
              type: 'boolean',
              description: 'Force extensions for every wordlist entry (not just entries without extensions)',
              default: false
            },
          },
        },
        commandTemplate: ['dirsearch', '-u', '{{target}}', '-e', '{{extensions}}', '-t', '{{threads}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'HTTPx',
      slug: 'httpx',
      description: 'HTTPx is a fast and multi-purpose HTTP toolkit that probes URLs for working web servers. It detects web technologies, status codes, titles, and content lengths. Excellent for reconnaissance and validating targets.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'httpx',
        argsSchema: {
          type: 'object',
          properties: {
            statusCode: {
              type: 'boolean',
              description: 'Display HTTP status code in output',
              default: true
            },
            title: {
              type: 'boolean',
              description: 'Display page title in output',
              default: true
            },
            tech: {
              type: 'boolean',
              description: 'Detect web technologies using Wappalyzer',
              default: true
            },
            contentLength: {
              type: 'boolean',
              description: 'Display response content length',
              default: false
            },
            webServer: {
              type: 'boolean',
              description: 'Display web server name from headers',
              default: false
            },
            ip: {
              type: 'boolean',
              description: 'Display resolved IP address',
              default: false
            },
            cname: {
              type: 'boolean',
              description: 'Display CNAME records',
              default: false
            },
            cdn: {
              type: 'boolean',
              description: 'Detect if target is using a CDN',
              default: false
            },
            responseTime: {
              type: 'boolean',
              description: 'Display response time',
              default: false
            },
            location: {
              type: 'boolean',
              description: 'Display redirect location',
              default: false
            },
            threads: {
              type: 'number',
              description: 'Number of concurrent threads',
              default: 50
            },
            timeout: {
              type: 'number',
              description: 'Request timeout in seconds',
              default: 15
            },
            followRedirects: {
              type: 'boolean',
              description: 'Follow HTTP redirects',
              default: false
            },
            maxRedirects: {
              type: 'number',
              description: 'Maximum number of redirects to follow',
              default: 10
            },
            json: {
              type: 'boolean',
              description: 'Output in JSON format',
              default: false
            },
            screenshot: {
              type: 'boolean',
              description: 'Take screenshot of target using headless browser',
              default: false
            },
            ports: {
              type: 'string',
              description: 'Ports to probe. Example: "80,443,8080,8443"'
            },
          },
        },
        commandTemplate: ['httpx', '-u', '{{target}}', '-status-code', '-title', '-tech-detect', '-no-color'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'Curl',
      slug: 'curl',
      description: 'cURL is a command-line tool for transferring data with URLs. It supports HTTP, HTTPS, FTP, and many other protocols. Essential for manual web testing, API probing, and debugging HTTP requests and responses.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'curl',
        argsSchema: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'],
              enumLabels: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'],
              description: 'HTTP request method to use',
              default: 'GET'
            },
            showHeaders: {
              type: 'boolean',
              description: 'Include HTTP headers in output',
              default: true
            },
            followRedirects: {
              type: 'boolean',
              description: 'Follow HTTP redirects (Location headers)',
              default: true
            },
            maxRedirects: {
              type: 'number',
              description: 'Maximum number of redirects to follow',
              default: 10
            },
            data: {
              type: 'string',
              description: 'POST data to send. Example: "username=admin&password=test"'
            },
            headers: {
              type: 'string',
              description: 'Custom headers. Format: "Header: value" (one per line)'
            },
            userAgent: {
              type: 'string',
              description: 'Custom User-Agent string',
              default: 'Mozilla/5.0 (compatible; HexStrike/1.0)'
            },
            cookie: {
              type: 'string',
              description: 'Cookie string to send with request'
            },
            timeout: {
              type: 'number',
              description: 'Maximum time in seconds for the request',
              default: 30
            },
            proxy: {
              type: 'string',
              description: 'Proxy URL to use (http://host:port)'
            },
            insecure: {
              type: 'boolean',
              description: 'Skip TLS/SSL certificate verification',
              default: false
            },
            verbose: {
              type: 'boolean',
              description: 'Verbose mode - show request/response details',
              default: false
            },
            compressed: {
              type: 'boolean',
              description: 'Request compressed response (gzip, deflate)',
              default: true
            },
          },
        },
        commandTemplate: ['curl', '-X', '{{method}}', '-I', '-L', '{{target}}'],
        timeout: 30,
        memoryLimit: 64,
      },
    },
    {
      name: 'File',
      slug: 'file',
      description: 'The file command determines the type of a file by examining its content and magic bytes, not just the extension. It identifies executables, archives, images, text files, and more. Essential first step in binary analysis.',
      category: 'binary',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'file',
        argsSchema: {
          type: 'object',
          properties: {
            mime: {
              type: 'boolean',
              description: 'Output MIME type string instead of human-readable description',
              default: false
            },
            brief: {
              type: 'boolean',
              description: 'Brief mode - don\'t prepend filenames to output',
              default: false
            },
            uncompress: {
              type: 'boolean',
              description: 'Try to look inside compressed files',
              default: false
            },
            keep: {
              type: 'boolean',
              description: 'Keep going after first match (show all matches)',
              default: false
            },
            special: {
              type: 'boolean',
              description: 'Don\'t treat special files (devices) specially',
              default: false
            },
          },
        },
        commandTemplate: ['file', '{{target}}'],
        timeout: 10,
        memoryLimit: 32,
      },
    },

    // ==================== ADDITIONAL NETWORK RECONNAISSANCE ====================
    {
      name: 'AutoRecon',
      slug: 'autorecon',
      description: 'AutoRecon is a multi-threaded network reconnaissance tool which performs automated enumeration of services. It\'s intended for use in CTFs and penetration tests, providing comprehensive automated scanning.',
      category: 'network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'autorecon',
        argsSchema: {
          type: 'object',
          properties: {
            ports: { type: 'string', description: 'Comma-separated list of ports to scan. Default scans top 1000' },
            singleTarget: { type: 'boolean', description: 'Only scan one target at a time', default: false },
            onlyScansDir: { type: 'boolean', description: 'Skip Nmap and only run service scans', default: false },
            heartbeat: { type: 'number', description: 'Seconds between heartbeat messages', default: 60 },
            nmap: { type: 'string', description: 'Additional Nmap arguments' },
            nmapAppend: { type: 'string', description: 'Append to default Nmap command' },
            verbose: { type: 'boolean', description: 'Enable verbose output', default: false },
            threads: { type: 'number', description: 'Number of concurrent service scans', default: 10 },
          },
        },
        commandTemplate: ['autorecon', '{{target}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Fierce',
      slug: 'fierce',
      description: 'Fierce is a DNS reconnaissance tool for locating non-contiguous IP space. It attempts to locate targets inside and outside the corporate network by performing DNS enumeration and zone transfers.',
      category: 'network',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'fierce',
        argsSchema: {
          type: 'object',
          properties: {
            dnsServer: { type: 'string', description: 'Custom DNS server to use' },
            range: { type: 'string', description: 'IP range to scan (e.g., 192.168.1.0/24)' },
            wordlist: { type: 'string', description: 'Custom wordlist for subdomain brute forcing' },
            delay: { type: 'number', description: 'Delay between lookups in seconds' },
            threads: { type: 'number', description: 'Number of threads', default: 5 },
            traverse: { type: 'number', description: 'Traverse IPs near discovered hosts', default: 5 },
            wide: { type: 'boolean', description: 'Scan entire class C ranges found', default: false },
          },
        },
        commandTemplate: ['fierce', '--domain', '{{target}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'DNSEnum',
      slug: 'dnsenum',
      description: 'DNSEnum is a multithreaded perl script to enumerate DNS information of a domain and discover non-contiguous IP blocks. It performs DNS brute forcing, zone transfers, and Google scraping.',
      category: 'network',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'dnsenum',
        argsSchema: {
          type: 'object',
          properties: {
            threads: { type: 'number', description: 'Number of threads for brute forcing', default: 5 },
            recursion: { type: 'boolean', description: 'Enable recursive subdomain enumeration', default: true },
            whois: { type: 'boolean', description: 'Perform whois lookup', default: true },
            subfile: { type: 'string', description: 'File containing subdomains to check' },
            dnsserver: { type: 'string', description: 'DNS server to use' },
            timeout: { type: 'number', description: 'TCP/UDP timeout in seconds', default: 10 },
            private: { type: 'boolean', description: 'Show private IPs', default: false },
          },
        },
        commandTemplate: ['dnsenum', '{{target}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'NBTScan',
      slug: 'nbtscan',
      description: 'NBTScan is a program for scanning IP networks for NetBIOS name information. It sends NetBIOS status queries and lists received information in human readable form.',
      category: 'network',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'nbtscan',
        argsSchema: {
          type: 'object',
          properties: {
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
            humanReadable: { type: 'boolean', description: 'Human readable output', default: true },
            retries: { type: 'number', description: 'Number of retries', default: 2 },
            timeout: { type: 'number', description: 'Timeout in milliseconds', default: 1000 },
          },
        },
        commandTemplate: ['nbtscan', '{{target}}'],
        timeout: 120,
        memoryLimit: 128,
      },
    },
    {
      name: 'RPCClient',
      slug: 'rpcclient',
      description: 'RPCClient is a tool for executing MS-RPC functions on remote systems. It can enumerate users, groups, shares, and other information from Windows systems via SMB.',
      category: 'network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'rpcclient',
        argsSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            nullSession: { type: 'boolean', description: 'Use null session (anonymous)', default: true },
            command: { type: 'string', description: 'RPC command to execute. e.g., enumdomusers, enumdomgroups, queryuser' },
            workgroup: { type: 'string', description: 'Workgroup/domain name' },
          },
        },
        commandTemplate: ['rpcclient', '-U', '', '-N', '{{target}}'],
        timeout: 120,
        memoryLimit: 128,
      },
    },
    {
      name: 'Enum4linux',
      slug: 'enum4linux',
      description: 'Enum4linux is a tool for enumerating information from Windows and Samba systems. It attempts to get userlist, shares, password policy, and more via null sessions.',
      category: 'network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'enum4linux',
        argsSchema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Run all enumeration options', default: true },
            users: { type: 'boolean', description: 'Enumerate users', default: false },
            shares: { type: 'boolean', description: 'Enumerate shares', default: false },
            groups: { type: 'boolean', description: 'Enumerate groups', default: false },
            policies: { type: 'boolean', description: 'Enumerate password policy', default: false },
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
          },
        },
        commandTemplate: ['enum4linux', '-a', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Enum4linux-ng',
      slug: 'enum4linux-ng',
      description: 'Enum4linux-ng is a next-generation rewrite of enum4linux in Python with additional features, JSON/YAML output, and improved reliability for SMB/NetBIOS enumeration.',
      category: 'network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'enum4linux-ng',
        argsSchema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Run all enumeration modules', default: true },
            users: { type: 'boolean', description: 'Enumerate users via RID cycling', default: false },
            shares: { type: 'boolean', description: 'Enumerate shares', default: false },
            groups: { type: 'boolean', description: 'Enumerate groups', default: false },
            services: { type: 'boolean', description: 'Enumerate services', default: false },
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            outputJson: { type: 'boolean', description: 'Output in JSON format', default: false },
            timeout: { type: 'number', description: 'Timeout for connections', default: 5 },
          },
        },
        commandTemplate: ['enum4linux-ng', '-A', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'SMBMap',
      slug: 'smbmap',
      description: 'SMBMap allows users to enumerate samba share drives across an entire domain, list share contents, and download/upload files where permitted.',
      category: 'network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'smbmap',
        argsSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            domain: { type: 'string', description: 'Domain name' },
            recursive: { type: 'boolean', description: 'Recursively list directories', default: false },
            depth: { type: 'number', description: 'Depth for recursive listing', default: 5 },
            excludeShare: { type: 'string', description: 'Shares to exclude from search' },
            pattern: { type: 'string', description: 'Search pattern for files' },
            nullSession: { type: 'boolean', description: 'Use null session', default: true },
          },
        },
        commandTemplate: ['smbmap', '-H', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Responder',
      slug: 'responder',
      description: 'Responder is a LLMNR, NBT-NS and MDNS poisoner. It will answer to specific queries based on their name suffix and respond with poisoned answers to capture credentials.',
      category: 'network',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'responder',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Network interface to listen on', required: true },
            analyze: { type: 'boolean', description: 'Analyze mode - don\'t poison, just listen', default: false },
            fingerprint: { type: 'boolean', description: 'Fingerprint hosts', default: false },
            lm: { type: 'boolean', description: 'Force LM hashing downgrade', default: false },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
            wpad: { type: 'boolean', description: 'Start WPAD rogue proxy', default: false },
            http: { type: 'boolean', description: 'Enable HTTP server', default: true },
            smb: { type: 'boolean', description: 'Enable SMB server', default: true },
          },
        },
        commandTemplate: ['responder', '-I', '{{interface}}', '-A'],
        timeout: 3600,
        memoryLimit: 256,
      },
    },
    {
      name: 'NetExec',
      slug: 'netexec',
      description: 'NetExec (formerly CrackMapExec) is a swiss army knife for pentesting networks. It supports SMB, WinRM, SSH, LDAP, MSSQL, and more with credential validation and command execution.',
      category: 'network',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'netexec',
        argsSchema: {
          type: 'object',
          properties: {
            protocol: {
              type: 'string',
              enum: ['smb', 'winrm', 'ssh', 'ldap', 'mssql', 'ftp', 'rdp'],
              description: 'Protocol to use',
              default: 'smb'
            },
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            hash: { type: 'string', description: 'NTLM hash for pass-the-hash' },
            domain: { type: 'string', description: 'Domain name' },
            localAuth: { type: 'boolean', description: 'Use local authentication', default: false },
            shares: { type: 'boolean', description: 'Enumerate shares', default: false },
            sessions: { type: 'boolean', description: 'Enumerate sessions', default: false },
            users: { type: 'boolean', description: 'Enumerate users', default: false },
            command: { type: 'string', description: 'Command to execute' },
          },
        },
        commandTemplate: ['netexec', '{{protocol}}', '{{target}}'],
        timeout: 300,
        memoryLimit: 512,
      },
    },

    // ==================== ADDITIONAL WEB SECURITY TOOLS ====================
    {
      name: 'FFuf',
      slug: 'ffuf',
      description: 'FFuf (Fuzz Faster U Fool) is a fast web fuzzer written in Go. It\'s extremely flexible and supports fuzzing of HTTP requests using the FUZZ keyword in any position.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'ffuf',
        argsSchema: {
          type: 'object',
          properties: {
            wordlist: { type: 'string', description: 'Path to wordlist', default: '/usr/share/wordlists/dirb/common.txt' },
            threads: { type: 'number', description: 'Number of threads', default: 40 },
            mc: { type: 'string', description: 'Match HTTP status codes. e.g., "200,301,302,401"' },
            fc: { type: 'string', description: 'Filter HTTP status codes. e.g., "404,403"' },
            fs: { type: 'string', description: 'Filter by response size' },
            fw: { type: 'string', description: 'Filter by word count' },
            fl: { type: 'string', description: 'Filter by line count' },
            timeout: { type: 'number', description: 'HTTP request timeout in seconds', default: 10 },
            recursion: { type: 'boolean', description: 'Enable recursion', default: false },
            recursionDepth: { type: 'number', description: 'Maximum recursion depth', default: 2 },
            extensions: { type: 'string', description: 'File extensions to fuzz. e.g., "php,html,js"' },
            headers: { type: 'string', description: 'Custom headers. Format: "Header: Value"' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
            data: { type: 'string', description: 'POST data' },
            mode: { type: 'string', enum: ['clusterbomb', 'pitchfork', 'sniper'], description: 'Fuzzing mode for multiple wordlists' },
          },
        },
        commandTemplate: ['ffuf', '-u', '{{target}}/FUZZ', '-w', '{{wordlist}}', '-t', '{{threads}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Katana',
      slug: 'katana',
      description: 'Katana is a next-generation crawling and spidering framework with support for JavaScript rendering, form parsing, scope control, and automatic API discovery.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'katana',
        argsSchema: {
          type: 'object',
          properties: {
            depth: { type: 'number', description: 'Maximum depth to crawl', default: 3 },
            headless: { type: 'boolean', description: 'Enable headless browser for JavaScript rendering', default: false },
            jsWait: { type: 'number', description: 'Wait time for JavaScript to render (seconds)', default: 0 },
            formFill: { type: 'boolean', description: 'Automatically fill forms during crawling', default: false },
            knownFiles: { type: 'boolean', description: 'Check for known files (robots.txt, sitemap.xml)', default: true },
            scope: { type: 'string', description: 'Regex pattern for in-scope URLs' },
            outOfScope: { type: 'string', description: 'Regex pattern for out-of-scope URLs' },
            concurrency: { type: 'number', description: 'Number of concurrent requests', default: 10 },
            timeout: { type: 'number', description: 'Request timeout in seconds', default: 10 },
            json: { type: 'boolean', description: 'Output in JSON format', default: false },
            automaticFormFill: { type: 'boolean', description: 'Fill forms automatically', default: false },
          },
        },
        commandTemplate: ['katana', '-u', '{{target}}', '-d', '{{depth}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Hakrawler',
      slug: 'hakrawler',
      description: 'Hakrawler is a fast web crawler designed for easy, quick discovery of endpoints and assets within a web application. It\'s great for reconnaissance.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'hakrawler',
        argsSchema: {
          type: 'object',
          properties: {
            depth: { type: 'number', description: 'Maximum depth to crawl', default: 2 },
            scope: { type: 'string', enum: ['strict', 'subs', 'fuzzy'], description: 'Scope of crawling', default: 'subs' },
            plain: { type: 'boolean', description: 'Plain output (no color)', default: false },
            insecure: { type: 'boolean', description: 'Disable TLS verification', default: false },
            threads: { type: 'number', description: 'Number of threads', default: 8 },
            timeout: { type: 'number', description: 'Request timeout', default: 10 },
            wayback: { type: 'boolean', description: 'Include Wayback Machine results', default: false },
          },
        },
        commandTemplate: ['hakrawler', '-url', '{{target}}', '-depth', '{{depth}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Gau',
      slug: 'gau',
      description: 'Gau (GetAllUrls) fetches known URLs from AlienVault\'s Open Threat Exchange, the Wayback Machine, Common Crawl, and URLScan for any given domain.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'gau',
        argsSchema: {
          type: 'object',
          properties: {
            providers: { type: 'string', description: 'Providers to use (comma-separated): wayback,commoncrawl,otx,urlscan' },
            blacklist: { type: 'string', description: 'Extensions to skip (comma-separated)' },
            threads: { type: 'number', description: 'Number of threads', default: 2 },
            retries: { type: 'number', description: 'Number of retries', default: 5 },
            subs: { type: 'boolean', description: 'Include subdomains', default: false },
            json: { type: 'boolean', description: 'Output in JSON format', default: false },
          },
        },
        commandTemplate: ['gau', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Waybackurls',
      slug: 'waybackurls',
      description: 'Waybackurls fetches all URLs that the Wayback Machine knows about for a domain. Useful for finding old endpoints, parameters, and hidden functionality.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'waybackurls',
        argsSchema: {
          type: 'object',
          properties: {
            noSubs: { type: 'boolean', description: 'Exclude subdomains', default: false },
            dates: { type: 'boolean', description: 'Show dates of capture', default: false },
          },
        },
        commandTemplate: ['waybackurls', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Arjun',
      slug: 'arjun',
      description: 'Arjun is an HTTP parameter discovery suite. It finds valid parameters for web endpoints by analyzing responses to requests with injected parameters.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'arjun',
        argsSchema: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST', 'JSON', 'XML'], description: 'HTTP method', default: 'GET' },
            threads: { type: 'number', description: 'Number of threads', default: 2 },
            delay: { type: 'number', description: 'Delay between requests in seconds', default: 0 },
            wordlist: { type: 'string', description: 'Custom wordlist for parameters' },
            headers: { type: 'string', description: 'Custom headers' },
            stable: { type: 'boolean', description: 'More stable but slower scan', default: false },
            includeIgnored: { type: 'boolean', description: 'Include ignored params', default: false },
          },
        },
        commandTemplate: ['arjun', '-u', '{{target}}', '-m', '{{method}}', '-t', '{{threads}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'ParamSpider',
      slug: 'paramspider',
      description: 'ParamSpider mines parameters from web archives (Wayback Machine). It helps find parameters that may be vulnerable to injection attacks.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'paramspider',
        argsSchema: {
          type: 'object',
          properties: {
            subs: { type: 'boolean', description: 'Include subdomains', default: false },
            level: { type: 'string', description: 'Level: high, medium, low', default: 'high' },
            exclude: { type: 'string', description: 'Extensions to exclude (comma-separated)' },
            placeholder: { type: 'string', description: 'Placeholder for parameter values', default: 'FUZZ' },
          },
        },
        commandTemplate: ['paramspider', '-d', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'X8',
      slug: 'x8',
      description: 'X8 is a hidden parameter discovery tool. It uses advanced techniques to find parameters that are not visible in the application but may be processed.',
      category: 'web',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'x8',
        argsSchema: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method', default: 'GET' },
            wordlist: { type: 'string', description: 'Custom wordlist for parameters' },
            threads: { type: 'number', description: 'Number of threads', default: 10 },
            timeout: { type: 'number', description: 'Request timeout', default: 10 },
            headers: { type: 'string', description: 'Custom headers' },
            verify: { type: 'boolean', description: 'Verify found parameters', default: true },
          },
        },
        commandTemplate: ['x8', '-u', '{{target}}', '-m', '{{method}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Jaeles',
      slug: 'jaeles',
      description: 'Jaeles is a web security testing framework with a powerful scanner that supports custom signatures for detecting vulnerabilities.',
      category: 'web',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'jaeles',
        argsSchema: {
          type: 'object',
          properties: {
            signs: { type: 'string', description: 'Signature to use (name or path)' },
            level: { type: 'number', description: 'Scan level (1-5)', default: 2 },
            threads: { type: 'number', description: 'Number of threads', default: 10 },
            timeout: { type: 'number', description: 'Request timeout', default: 20 },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
            passive: { type: 'boolean', description: 'Passive mode only', default: false },
            chunk: { type: 'number', description: 'Chunk size for parallel processing', default: 20 },
          },
        },
        commandTemplate: ['jaeles', 'scan', '-u', '{{target}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Dalfox',
      slug: 'dalfox',
      description: 'Dalfox is a powerful open-source XSS scanner focused on automation and performance. It supports DOM-based XSS detection and advanced payload generation.',
      category: 'web',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'dalfox',
        argsSchema: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method', default: 'GET' },
            data: { type: 'string', description: 'POST data' },
            cookie: { type: 'string', description: 'Cookie string' },
            headers: { type: 'string', description: 'Custom headers' },
            blind: { type: 'string', description: 'Blind XSS callback URL' },
            mining: { type: 'boolean', description: 'Parameter mining', default: true },
            miningDict: { type: 'boolean', description: 'Dictionary-based parameter mining', default: false },
            deep: { type: 'boolean', description: 'Deep DOM analysis', default: false },
            followRedirect: { type: 'boolean', description: 'Follow redirects', default: true },
            timeout: { type: 'number', description: 'Request timeout', default: 10 },
            workers: { type: 'number', description: 'Number of workers', default: 100 },
          },
        },
        commandTemplate: ['dalfox', 'url', '{{target}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Wafw00f',
      slug: 'wafw00f',
      description: 'WAFW00F identifies and fingerprints Web Application Firewall (WAF) products protecting a website. It helps understand security controls before testing.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'wafw00f',
        argsSchema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Test all WAF signatures', default: false },
            headers: { type: 'string', description: 'Custom headers' },
            proxy: { type: 'string', description: 'Proxy URL' },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
            findAll: { type: 'boolean', description: 'Find all matching WAFs', default: false },
          },
        },
        commandTemplate: ['wafw00f', '{{target}}'],
        timeout: 120,
        memoryLimit: 128,
      },
    },
    {
      name: 'TestSSL',
      slug: 'testssl',
      description: 'TestSSL.sh is a comprehensive command-line tool that checks a server\'s SSL/TLS configuration for security issues, cipher suites, protocols, and vulnerabilities.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'testssl',
        argsSchema: {
          type: 'object',
          properties: {
            protocols: { type: 'boolean', description: 'Check protocols only', default: false },
            ciphers: { type: 'boolean', description: 'Check ciphers only', default: false },
            vulnerabilities: { type: 'boolean', description: 'Check vulnerabilities only', default: false },
            headers: { type: 'boolean', description: 'Check HTTP headers', default: true },
            serverDefaults: { type: 'boolean', description: 'Show server defaults', default: true },
            full: { type: 'boolean', description: 'Full scan', default: true },
            quiet: { type: 'boolean', description: 'Quiet mode', default: false },
            json: { type: 'boolean', description: 'JSON output', default: false },
            parallel: { type: 'boolean', description: 'Parallel mode for faster scanning', default: true },
          },
        },
        commandTemplate: ['testssl', '{{target}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'SSLScan',
      slug: 'sslscan',
      description: 'SSLScan queries SSL/TLS services to determine supported ciphers, protocols, and certificate information. Fast and reliable SSL testing.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'sslscan',
        argsSchema: {
          type: 'object',
          properties: {
            showCertificate: { type: 'boolean', description: 'Show certificate details', default: true },
            noColor: { type: 'boolean', description: 'Disable colored output', default: false },
            xml: { type: 'boolean', description: 'XML output', default: false },
            json: { type: 'boolean', description: 'JSON output', default: false },
            noHeartbleed: { type: 'boolean', description: 'Skip Heartbleed test', default: false },
            starttls: { type: 'string', enum: ['smtp', 'ftp', 'imap', 'pop3', 'ldap', 'xmpp'], description: 'STARTTLS protocol' },
            tlsAll: { type: 'boolean', description: 'Test all TLS versions', default: true },
          },
        },
        commandTemplate: ['sslscan', '{{target}}'],
        timeout: 120,
        memoryLimit: 128,
      },
    },
    {
      name: 'SSLyze',
      slug: 'sslyze',
      description: 'SSLyze is a fast and powerful SSL/TLS scanning library and CLI tool. It can analyze SSL/TLS configuration of servers for compliance and vulnerabilities.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'sslyze',
        argsSchema: {
          type: 'object',
          properties: {
            regular: { type: 'boolean', description: 'Run regular scan (recommended)', default: true },
            certInfo: { type: 'boolean', description: 'Certificate information', default: true },
            sslv2: { type: 'boolean', description: 'Test SSLv2', default: true },
            sslv3: { type: 'boolean', description: 'Test SSLv3', default: true },
            tlsv1: { type: 'boolean', description: 'Test TLSv1.0', default: true },
            tlsv1_1: { type: 'boolean', description: 'Test TLSv1.1', default: true },
            tlsv1_2: { type: 'boolean', description: 'Test TLSv1.2', default: true },
            tlsv1_3: { type: 'boolean', description: 'Test TLSv1.3', default: true },
            heartbleed: { type: 'boolean', description: 'Test for Heartbleed', default: true },
            json: { type: 'boolean', description: 'JSON output', default: false },
          },
        },
        commandTemplate: ['sslyze', '--regular', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Whatweb',
      slug: 'whatweb',
      description: 'WhatWeb identifies websites. It recognizes web technologies including CMS, frameworks, server software, analytics packages, and more from 1800+ plugins.',
      category: 'web',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'whatweb',
        argsSchema: {
          type: 'object',
          properties: {
            aggression: { type: 'number', enum: [1, 2, 3, 4], description: 'Aggression level (1=stealthy, 4=heavy)', default: 1 },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
            color: { type: 'string', enum: ['always', 'never', 'auto'], description: 'Color mode', default: 'auto' },
            noErrors: { type: 'boolean', description: 'Suppress error messages', default: false },
            userAgent: { type: 'string', description: 'Custom User-Agent' },
            proxy: { type: 'string', description: 'Proxy URL' },
            header: { type: 'string', description: 'Custom headers' },
          },
        },
        commandTemplate: ['whatweb', '-a', '{{aggression}}', '{{target}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'JWT-Tool',
      slug: 'jwt-tool',
      description: 'JWT_Tool is a toolkit for validating, forging, scanning, and tampering with JSON Web Tokens. It tests for common JWT vulnerabilities.',
      category: 'api',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'jwt_tool',
        argsSchema: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT token to test', required: true },
            targetUrl: { type: 'string', description: 'URL to test the token against' },
            scan: { type: 'boolean', description: 'Scan for common vulnerabilities', default: true },
            exploit: { type: 'string', enum: ['a', 'n', 'b', 's', 'k', 'p', 'i'], description: 'Exploit mode: a=alg:none, n=null sig, b=blank pwd, s=CVE-2015-9235, k=key confusion, p=PKCS, i=inject' },
            crack: { type: 'string', description: 'Wordlist for brute forcing secret' },
            mode: { type: 'string', enum: ['pb', 'at', 'jt', 'cc'], description: 'Mode: pb=playbook, at=all tests, jt=jwks test, cc=claim check' },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
          },
        },
        commandTemplate: ['jwt_tool', '{{token}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Commix',
      slug: 'commix',
      description: 'Commix (command injection exploiter) is an automated tool for detecting and exploiting command injection vulnerabilities in web applications.',
      category: 'web',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'commix',
        argsSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'POST data' },
            cookie: { type: 'string', description: 'Cookie string' },
            level: { type: 'number', enum: [1, 2, 3], description: 'Level of tests (1-3)', default: 1 },
            technique: { type: 'string', description: 'Techniques: (c)lassic, (e)valuation, (t)ime-based, (f)ile-based', default: 'cetf' },
            osCmd: { type: 'string', description: 'Execute this OS command' },
            shellshock: { type: 'boolean', description: 'Test for Shellshock', default: false },
            tamper: { type: 'string', description: 'Tamper script to use' },
            proxy: { type: 'string', description: 'Proxy URL' },
            timeout: { type: 'number', description: 'Timeout in seconds', default: 30 },
            batch: { type: 'boolean', description: 'Never ask for user input', default: true },
          },
        },
        commandTemplate: ['commix', '-u', '{{target}}', '--batch'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'NoSQLMap',
      slug: 'nosqlmap',
      description: 'NoSQLMap is an automated NoSQL database enumeration and web application exploitation tool for MongoDB, CouchDB, Redis, and Cassandra.',
      category: 'web',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'nosqlmap',
        argsSchema: {
          type: 'object',
          properties: {
            attack: { type: 'string', enum: ['1', '2', '3', '4', '5'], description: '1=Default scan, 2=NoSQL injection, 3=Scanner, 4=User enum, 5=Password brute', default: '1' },
            dbType: { type: 'string', enum: ['mongodb', 'couchdb', 'redis'], description: 'Database type' },
            postData: { type: 'string', description: 'POST data' },
            method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method', default: 'GET' },
          },
        },
        commandTemplate: ['nosqlmap', '-u', '{{target}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Tplmap',
      slug: 'tplmap',
      description: 'Tplmap assists exploitation of server-side template injection vulnerabilities. It supports multiple template engines like Jinja2, Smarty, Twig, etc.',
      category: 'web',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'tplmap',
        argsSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'POST data' },
            cookie: { type: 'string', description: 'Cookie string' },
            method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method', default: 'GET' },
            engine: { type: 'string', description: 'Force template engine (Jinja2, Mako, Smarty, etc.)' },
            osShell: { type: 'boolean', description: 'Get OS shell', default: false },
            osCmd: { type: 'string', description: 'Execute OS command' },
            tplShell: { type: 'boolean', description: 'Get template shell', default: false },
            level: { type: 'number', description: 'Level of tests', default: 1 },
          },
        },
        commandTemplate: ['tplmap', '-u', '{{target}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },

    // ==================== ADDITIONAL PASSWORD & AUTH TOOLS ====================
    {
      name: 'Medusa',
      slug: 'medusa',
      description: 'Medusa is a speedy, parallel, and modular login brute-forcer. It supports many protocols including HTTP, FTP, SSH, SMB, MSSQL, MySQL, and more.',
      category: 'password',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'medusa',
        argsSchema: {
          type: 'object',
          properties: {
            module: { type: 'string', description: 'Module to use (ssh, ftp, http, smb, etc.)', required: true },
            username: { type: 'string', description: 'Single username' },
            usernameFile: { type: 'string', description: 'File with usernames' },
            password: { type: 'string', description: 'Single password' },
            passwordFile: { type: 'string', description: 'File with passwords', default: '/usr/share/wordlists/rockyou.txt' },
            threads: { type: 'number', description: 'Number of parallel logins', default: 16 },
            port: { type: 'number', description: 'Target port' },
            ssl: { type: 'boolean', description: 'Use SSL', default: false },
            timeout: { type: 'number', description: 'Timeout in seconds', default: 30 },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
          },
        },
        commandTemplate: ['medusa', '-h', '{{target}}', '-M', '{{module}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Patator',
      slug: 'patator',
      description: 'Patator is a multi-purpose brute-forcer with a modular design and flexible usage. It supports many protocols and is highly customizable.',
      category: 'password',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'patator',
        argsSchema: {
          type: 'object',
          properties: {
            module: { type: 'string', description: 'Module: ftp_login, ssh_login, http_fuzz, etc.', required: true },
            threads: { type: 'number', description: 'Number of threads', default: 10 },
            timeout: { type: 'number', description: 'Timeout per request', default: 10 },
            retries: { type: 'number', description: 'Number of retries', default: 2 },
            rateLimit: { type: 'number', description: 'Wait time between requests (ms)', default: 0 },
          },
        },
        commandTemplate: ['patator', '{{module}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Evil-WinRM',
      slug: 'evil-winrm',
      description: 'Evil-WinRM is a Windows Remote Management (WinRM) shell for pentesting. It provides PowerShell remoting with file transfer and other features.',
      category: 'password',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'evil-winrm',
        argsSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username', required: true },
            password: { type: 'string', description: 'Password' },
            hash: { type: 'string', description: 'NTLM hash for pass-the-hash' },
            ssl: { type: 'boolean', description: 'Enable SSL', default: false },
            port: { type: 'number', description: 'WinRM port', default: 5985 },
            scripts: { type: 'string', description: 'Path to PowerShell scripts directory' },
            executables: { type: 'string', description: 'Path to executables directory' },
          },
        },
        commandTemplate: ['evil-winrm', '-i', '{{target}}', '-u', '{{username}}'],
        timeout: 3600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Hash-Identifier',
      slug: 'hash-identifier',
      description: 'Hash-Identifier is a tool to identify different types of hashes. It analyzes the hash and suggests possible algorithms.',
      category: 'password',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'hash-identifier',
        argsSchema: {
          type: 'object',
          properties: {
            hash: { type: 'string', description: 'Hash to identify', required: true },
          },
        },
        commandTemplate: ['hash-identifier'],
        timeout: 30,
        memoryLimit: 64,
      },
    },
    {
      name: 'HashID',
      slug: 'hashid',
      description: 'HashID identifies the different types of hashes used to encrypt data and passwords. Supports 220+ hash types with confidence scoring.',
      category: 'password',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'hashid',
        argsSchema: {
          type: 'object',
          properties: {
            hash: { type: 'string', description: 'Hash to identify', required: true },
            extended: { type: 'boolean', description: 'List all possible hash types', default: false },
            mode: { type: 'boolean', description: 'Show Hashcat mode', default: true },
            john: { type: 'boolean', description: 'Show John format', default: true },
          },
        },
        commandTemplate: ['hashid', '-m', '-j', '{{hash}}'],
        timeout: 30,
        memoryLimit: 64,
      },
    },

    // ==================== ADDITIONAL BINARY ANALYSIS & REVERSE ENGINEERING ====================
    {
      name: 'GDB',
      slug: 'gdb',
      description: 'GDB (GNU Debugger) is a powerful debugger for programs written in C, C++, and other languages. Essential for exploit development and binary analysis.',
      category: 'binary',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'gdb',
        argsSchema: {
          type: 'object',
          properties: {
            args: { type: 'string', description: 'Arguments to pass to the program' },
            core: { type: 'string', description: 'Core dump file to analyze' },
            quiet: { type: 'boolean', description: 'Quiet mode', default: true },
            batch: { type: 'boolean', description: 'Batch mode (non-interactive)', default: false },
            commands: { type: 'string', description: 'GDB commands to execute' },
          },
        },
        commandTemplate: ['gdb', '-q', '{{target}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Radare2',
      slug: 'radare2',
      description: 'Radare2 is an advanced command-line reverse engineering framework. It supports disassembly, debugging, binary patching, and forensics analysis.',
      category: 'binary',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'r2',
        argsSchema: {
          type: 'object',
          properties: {
            analyze: { type: 'boolean', description: 'Analyze all (aaa)', default: true },
            debug: { type: 'boolean', description: 'Debug mode', default: false },
            write: { type: 'boolean', description: 'Open in write mode', default: false },
            arch: { type: 'string', description: 'Force architecture (x86, arm, mips, etc.)' },
            bits: { type: 'number', enum: [8, 16, 32, 64], description: 'Force bit size' },
            commands: { type: 'string', description: 'R2 commands to execute' },
            json: { type: 'boolean', description: 'JSON output', default: false },
          },
        },
        commandTemplate: ['r2', '-A', '{{target}}'],
        timeout: 1800,
        memoryLimit: 2048,
      },
    },
    {
      name: 'Ghidra',
      slug: 'ghidra',
      description: 'Ghidra is a software reverse engineering suite developed by NSA. It provides disassembly, decompilation, scripting, and graphing capabilities.',
      category: 'binary',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'ghidra',
        argsSchema: {
          type: 'object',
          properties: {
            headless: { type: 'boolean', description: 'Run in headless mode', default: true },
            project: { type: 'string', description: 'Project directory path' },
            projectName: { type: 'string', description: 'Project name' },
            script: { type: 'string', description: 'Script to run' },
            analyze: { type: 'boolean', description: 'Perform analysis', default: true },
          },
        },
        commandTemplate: ['ghidra', '{{target}}'],
        timeout: 3600,
        memoryLimit: 4096,
      },
    },
    {
      name: 'ROPgadget',
      slug: 'ropgadget',
      description: 'ROPgadget searches for gadgets in binaries to facilitate Return-Oriented Programming (ROP) exploits. Supports multiple architectures.',
      category: 'binary',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'ROPgadget',
        argsSchema: {
          type: 'object',
          properties: {
            depth: { type: 'number', description: 'Depth for gadget search', default: 10 },
            all: { type: 'boolean', description: 'Dump all gadgets', default: false },
            ropchain: { type: 'boolean', description: 'Generate ROP chain', default: false },
            badbytes: { type: 'string', description: 'Bad bytes to avoid (e.g., "00 0a 0d")' },
            only: { type: 'string', description: 'Only show specific instruction types' },
            filter: { type: 'string', description: 'Filter gadgets' },
            multibr: { type: 'boolean', description: 'Show multi-branch gadgets', default: false },
          },
        },
        commandTemplate: ['ROPgadget', '--binary', '{{target}}'],
        timeout: 300,
        memoryLimit: 512,
      },
    },
    {
      name: 'Ropper',
      slug: 'ropper',
      description: 'Ropper displays information about binary files and finds gadgets for ROP/JOP/SOP chains. Supports multiple architectures and output formats.',
      category: 'binary',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'ropper',
        argsSchema: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Search for specific gadgets' },
            quality: { type: 'number', description: 'Gadget quality (1=good, higher=less good)', default: 1 },
            badbytes: { type: 'string', description: 'Bad bytes to avoid' },
            type: { type: 'string', enum: ['rop', 'jop', 'all'], description: 'Gadget type', default: 'rop' },
            chain: { type: 'string', enum: ['execve', 'mprotect', 'virtualprotect'], description: 'Generate chain' },
            arch: { type: 'string', description: 'Force architecture' },
          },
        },
        commandTemplate: ['ropper', '--file', '{{target}}'],
        timeout: 300,
        memoryLimit: 512,
      },
    },
    {
      name: 'One-Gadget',
      slug: 'one-gadget',
      description: 'One-Gadget finds "one-shot" RCE gadgets in libc. These are single gadgets that can spawn a shell with minimal constraints.',
      category: 'binary',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'one_gadget',
        argsSchema: {
          type: 'object',
          properties: {
            level: { type: 'number', description: 'Gadget search level', default: 1 },
            buildid: { type: 'string', description: 'Find by Build ID' },
            raw: { type: 'boolean', description: 'Raw output (offsets only)', default: false },
            base: { type: 'string', description: 'Base address for calculations' },
          },
        },
        commandTemplate: ['one_gadget', '{{target}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'Objdump',
      slug: 'objdump',
      description: 'GNU objdump displays information about object files. It can disassemble code, display headers, and show relocation entries.',
      category: 'binary',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'objdump',
        argsSchema: {
          type: 'object',
          properties: {
            disassemble: { type: 'boolean', description: 'Disassemble executable sections', default: true },
            allHeaders: { type: 'boolean', description: 'Display all headers', default: false },
            fileHeaders: { type: 'boolean', description: 'Display file headers', default: false },
            sectionHeaders: { type: 'boolean', description: 'Display section headers', default: false },
            symbols: { type: 'boolean', description: 'Display symbol table', default: false },
            dynamicSymbols: { type: 'boolean', description: 'Display dynamic symbol table', default: false },
            reloc: { type: 'boolean', description: 'Display relocation entries', default: false },
            intel: { type: 'boolean', description: 'Use Intel syntax', default: true },
          },
        },
        commandTemplate: ['objdump', '-d', '-M', 'intel', '{{target}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'Readelf',
      slug: 'readelf',
      description: 'Readelf displays information about ELF format files. It shows headers, sections, symbols, and other ELF structure details.',
      category: 'binary',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'readelf',
        argsSchema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Display all information', default: true },
            fileHeader: { type: 'boolean', description: 'Display ELF file header', default: false },
            programHeaders: { type: 'boolean', description: 'Display program headers', default: false },
            sectionHeaders: { type: 'boolean', description: 'Display section headers', default: false },
            symbols: { type: 'boolean', description: 'Display symbol tables', default: false },
            dynamic: { type: 'boolean', description: 'Display dynamic section', default: false },
            relocs: { type: 'boolean', description: 'Display relocations', default: false },
          },
        },
        commandTemplate: ['readelf', '-a', '{{target}}'],
        timeout: 60,
        memoryLimit: 128,
      },
    },
    {
      name: 'Pwntools',
      slug: 'pwntools',
      description: 'Pwntools is a CTF framework and exploit development library. It provides tools for binary exploitation, ROP chain building, and shellcode generation.',
      category: 'binary',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'pwn',
        argsSchema: {
          type: 'object',
          properties: {
            checksec: { type: 'boolean', description: 'Check binary security features', default: false },
            disasm: { type: 'string', description: 'Disassemble hex string' },
            asm: { type: 'string', description: 'Assemble instructions' },
            shellcraft: { type: 'string', description: 'Generate shellcode' },
            cyclic: { type: 'number', description: 'Generate cyclic pattern' },
            cyclicFind: { type: 'string', description: 'Find offset in cyclic pattern' },
          },
        },
        commandTemplate: ['pwn', 'checksec', '{{target}}'],
        timeout: 60,
        memoryLimit: 256,
      },
    },
    {
      name: 'MSFVenom',
      slug: 'msfvenom',
      description: 'MSFVenom is the Metasploit payload generator. It creates various types of payloads with encoding to evade detection.',
      category: 'exploit',
      riskLevel: Severity.CRITICAL,
      manifest: {
        binary: 'msfvenom',
        argsSchema: {
          type: 'object',
          properties: {
            payload: { type: 'string', description: 'Payload to use (e.g., windows/meterpreter/reverse_tcp)', required: true },
            format: { type: 'string', description: 'Output format (exe, elf, raw, python, etc.)', default: 'raw' },
            lhost: { type: 'string', description: 'Listener IP address' },
            lport: { type: 'number', description: 'Listener port' },
            encoder: { type: 'string', description: 'Encoder to use' },
            iterations: { type: 'number', description: 'Encoding iterations', default: 1 },
            badChars: { type: 'string', description: 'Bad characters to avoid' },
            arch: { type: 'string', description: 'Architecture (x86, x64, etc.)' },
            platform: { type: 'string', description: 'Platform (windows, linux, etc.)' },
          },
        },
        commandTemplate: ['msfvenom', '-p', '{{payload}}'],
        timeout: 120,
        memoryLimit: 512,
      },
    },

    // ==================== CLOUD & CONTAINER SECURITY ====================
    {
      name: 'Prowler',
      slug: 'prowler',
      description: 'Prowler is an AWS/Azure/GCP security assessment tool. It performs security best practices checks and compliance audits.',
      category: 'cloud',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'prowler',
        argsSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: ['aws', 'azure', 'gcp'], description: 'Cloud provider', default: 'aws' },
            checks: { type: 'string', description: 'Specific checks to run' },
            services: { type: 'string', description: 'Specific services to audit' },
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'informational'], description: 'Minimum severity' },
            compliance: { type: 'string', description: 'Compliance framework (cis, gdpr, hipaa, etc.)' },
            region: { type: 'string', description: 'AWS region to scan' },
            json: { type: 'boolean', description: 'JSON output', default: false },
          },
        },
        commandTemplate: ['prowler', '{{provider}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Scout Suite',
      slug: 'scoutsuite',
      description: 'Scout Suite is a multi-cloud security auditing tool. It gathers configuration data and highlights risk areas in AWS, Azure, GCP, and more.',
      category: 'cloud',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'scout',
        argsSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: ['aws', 'azure', 'gcp', 'aliyun', 'oci'], description: 'Cloud provider', default: 'aws' },
            profile: { type: 'string', description: 'AWS profile to use' },
            regions: { type: 'string', description: 'Regions to scan (comma-separated)' },
            services: { type: 'string', description: 'Services to audit' },
            rulesets: { type: 'string', description: 'Custom ruleset file' },
            maxWorkers: { type: 'number', description: 'Maximum worker threads', default: 4 },
          },
        },
        commandTemplate: ['scout', '{{provider}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Trivy',
      slug: 'trivy',
      description: 'Trivy is a comprehensive vulnerability scanner for containers, file systems, Git repositories, and Infrastructure as Code configurations.',
      category: 'cloud',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'trivy',
        argsSchema: {
          type: 'object',
          properties: {
            scanType: { type: 'string', enum: ['image', 'fs', 'repo', 'config', 'k8s'], description: 'Type of scan', default: 'image' },
            severity: { type: 'string', description: 'Severities to report (CRITICAL,HIGH,MEDIUM,LOW)', default: 'CRITICAL,HIGH' },
            ignoreUnfixed: { type: 'boolean', description: 'Ignore unfixed vulnerabilities', default: false },
            format: { type: 'string', enum: ['table', 'json', 'sarif', 'cyclonedx'], description: 'Output format', default: 'table' },
            timeout: { type: 'string', description: 'Timeout duration', default: '5m' },
            skipUpdate: { type: 'boolean', description: 'Skip database update', default: false },
          },
        },
        commandTemplate: ['trivy', '{{scanType}}', '{{target}}'],
        timeout: 600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Kube-Hunter',
      slug: 'kube-hunter',
      description: 'Kube-hunter hunts for security weaknesses in Kubernetes clusters. It can run from inside or outside the cluster.',
      category: 'cloud',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'kube-hunter',
        argsSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['remote', 'internal', 'network'], description: 'Hunting mode', default: 'remote' },
            cidr: { type: 'string', description: 'CIDR range to scan' },
            active: { type: 'boolean', description: 'Enable active hunting (exploitation)', default: false },
            report: { type: 'string', enum: ['plain', 'yaml', 'json'], description: 'Report format', default: 'plain' },
            statistics: { type: 'boolean', description: 'Show statistics', default: true },
            quick: { type: 'boolean', description: 'Quick scan', default: false },
          },
        },
        commandTemplate: ['kube-hunter', '--remote', '{{target}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Kube-Bench',
      slug: 'kube-bench',
      description: 'Kube-bench checks whether Kubernetes is deployed securely by running the CIS Kubernetes Benchmark checks.',
      category: 'cloud',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'kube-bench',
        argsSchema: {
          type: 'object',
          properties: {
            benchmark: { type: 'string', description: 'CIS benchmark version to use' },
            targets: { type: 'string', description: 'Targets to check (master, node, etcd, policies)' },
            json: { type: 'boolean', description: 'JSON output', default: false },
            junit: { type: 'boolean', description: 'JUnit XML output', default: false },
            version: { type: 'string', description: 'Kubernetes version' },
          },
        },
        commandTemplate: ['kube-bench', 'run'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Docker Bench Security',
      slug: 'docker-bench',
      description: 'Docker Bench for Security is a script that checks for dozens of common best-practices around deploying Docker containers in production.',
      category: 'cloud',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'docker-bench-security',
        argsSchema: {
          type: 'object',
          properties: {
            check: { type: 'string', description: 'Specific check to run (e.g., 1.1, 2.2)' },
            exclude: { type: 'string', description: 'Checks to exclude' },
            format: { type: 'string', enum: ['json', 'text'], description: 'Output format', default: 'text' },
            include: { type: 'string', description: 'Checks to include' },
          },
        },
        commandTemplate: ['docker-bench-security'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Checkov',
      slug: 'checkov',
      description: 'Checkov is a static code analysis tool for Infrastructure as Code. It scans Terraform, CloudFormation, Kubernetes, and more for misconfigurations.',
      category: 'cloud',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'checkov',
        argsSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Directory to scan' },
            file: { type: 'string', description: 'Single file to scan' },
            framework: { type: 'string', description: 'Framework to scan (terraform, cloudformation, kubernetes, etc.)' },
            check: { type: 'string', description: 'Specific checks to run' },
            skipCheck: { type: 'string', description: 'Checks to skip' },
            output: { type: 'string', enum: ['cli', 'json', 'junitxml', 'sarif'], description: 'Output format', default: 'cli' },
            softFail: { type: 'boolean', description: 'Do not return error code for failed checks', default: false },
          },
        },
        commandTemplate: ['checkov', '-d', '{{target}}'],
        timeout: 300,
        memoryLimit: 512,
      },
    },

    // ==================== ADDITIONAL FORENSICS & CTF TOOLS ====================
    {
      name: 'Volatility3',
      slug: 'volatility3',
      description: 'Volatility 3 is the next-generation memory forensics framework. It extracts digital artifacts from volatile memory (RAM) dumps.',
      category: 'forensics',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'vol3',
        argsSchema: {
          type: 'object',
          properties: {
            plugin: { type: 'string', description: 'Plugin to run (windows.pslist, linux.bash, etc.)', required: true },
            profile: { type: 'string', description: 'Memory profile (auto-detected usually)' },
            output: { type: 'string', enum: ['quick', 'text', 'json', 'csv'], description: 'Output format', default: 'text' },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
          },
        },
        commandTemplate: ['vol3', '-f', '{{target}}', '{{plugin}}'],
        timeout: 1800,
        memoryLimit: 4096,
      },
    },
    {
      name: 'PhotoRec',
      slug: 'photorec',
      description: 'PhotoRec is file data recovery software designed to recover lost files from hard disks, CD-ROMs, and digital camera memory.',
      category: 'forensics',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'photorec',
        argsSchema: {
          type: 'object',
          properties: {
            fileType: { type: 'string', description: 'File types to recover (e.g., jpg, pdf, doc)' },
            partition: { type: 'string', description: 'Specific partition to scan' },
            freespace: { type: 'boolean', description: 'Only scan freespace', default: false },
          },
        },
        commandTemplate: ['photorec', '{{target}}'],
        timeout: 3600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Stegsolve',
      slug: 'stegsolve',
      description: 'Stegsolve is a steganography analysis tool that applies various color filters and bit plane analysis to images to reveal hidden data.',
      category: 'forensics',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'stegsolve',
        argsSchema: {
          type: 'object',
          properties: {
            analyze: { type: 'boolean', description: 'Run analysis', default: true },
          },
        },
        commandTemplate: ['stegsolve', '{{target}}'],
        timeout: 120,
        memoryLimit: 512,
      },
    },
    {
      name: 'Zsteg',
      slug: 'zsteg',
      description: 'Zsteg detects steganography data hidden in PNG and BMP files. It checks LSB steganography, hidden data in color planes, and more.',
      category: 'forensics',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'zsteg',
        argsSchema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Try all methods', default: true },
            bits: { type: 'string', description: 'Bit planes to check (e.g., 1,2,3)' },
            order: { type: 'string', description: 'Bit order (auto, lsb, msb)' },
            extract: { type: 'string', description: 'Extract data using specific method' },
            limit: { type: 'number', description: 'Limit output bytes', default: 256 },
          },
        },
        commandTemplate: ['zsteg', '-a', '{{target}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'Scalpel',
      slug: 'scalpel',
      description: 'Scalpel is a fast file carver that reads a database of header and footer definitions and extracts matching files from data.',
      category: 'forensics',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'scalpel',
        argsSchema: {
          type: 'object',
          properties: {
            outputDir: { type: 'string', description: 'Output directory', default: '/tmp/scalpel-output' },
            configFile: { type: 'string', description: 'Custom configuration file' },
            preview: { type: 'boolean', description: 'Preview mode only', default: false },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
          },
        },
        commandTemplate: ['scalpel', '-o', '{{outputDir}}', '{{target}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Bulk Extractor',
      slug: 'bulk-extractor',
      description: 'Bulk Extractor is a high-performance digital forensics tool. It extracts features such as email addresses, URLs, credit card numbers from disk images.',
      category: 'forensics',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'bulk_extractor',
        argsSchema: {
          type: 'object',
          properties: {
            outputDir: { type: 'string', description: 'Output directory', required: true },
            scanners: { type: 'string', description: 'Enable specific scanners (email, url, etc.)' },
            disableScanners: { type: 'string', description: 'Disable specific scanners' },
            threads: { type: 'number', description: 'Number of threads', default: 4 },
            wordlist: { type: 'string', description: 'Generate word list file' },
          },
        },
        commandTemplate: ['bulk_extractor', '-o', '{{outputDir}}', '{{target}}'],
        timeout: 3600,
        memoryLimit: 2048,
      },
    },

    // ==================== ADDITIONAL OSINT & BUG BOUNTY TOOLS ====================
    {
      name: 'Aquatone',
      slug: 'aquatone',
      description: 'Aquatone is a tool for visual inspection of websites across multiple hosts. It takes screenshots and generates HTML reports for review.',
      category: 'osint',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'aquatone',
        argsSchema: {
          type: 'object',
          properties: {
            ports: { type: 'string', description: 'Ports to scan', default: '80,443,8080,8443' },
            threads: { type: 'number', description: 'Number of threads', default: 2 },
            timeout: { type: 'number', description: 'Timeout in milliseconds', default: 60000 },
            resolution: { type: 'string', description: 'Screenshot resolution', default: '1440,900' },
            fullPage: { type: 'boolean', description: 'Capture full page', default: false },
            scanTimeout: { type: 'number', description: 'Timeout for port scan', default: 3000 },
          },
        },
        commandTemplate: ['aquatone'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Subjack',
      slug: 'subjack',
      description: 'Subjack is a subdomain takeover tool written in Go. It scans a list of subdomains concurrently to identify ones susceptible to takeover.',
      category: 'osint',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'subjack',
        argsSchema: {
          type: 'object',
          properties: {
            wordlist: { type: 'string', description: 'List of subdomains to check' },
            threads: { type: 'number', description: 'Number of threads', default: 10 },
            timeout: { type: 'number', description: 'Timeout in seconds', default: 10 },
            ssl: { type: 'boolean', description: 'Use HTTPS', default: true },
            all: { type: 'boolean', description: 'Check all fingerprints', default: true },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
          },
        },
        commandTemplate: ['subjack', '-d', '{{target}}', '-ssl', '-a'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Sherlock',
      slug: 'sherlock',
      description: 'Sherlock hunts down social media accounts by username across 400+ social networks. Useful for OSINT and identity investigation.',
      category: 'osint',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'sherlock',
        argsSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username to search', required: true },
            site: { type: 'string', description: 'Specific site to check' },
            timeout: { type: 'number', description: 'Request timeout', default: 60 },
            print: { type: 'boolean', description: 'Print results to terminal', default: true },
            csv: { type: 'boolean', description: 'Create CSV output', default: false },
            json: { type: 'boolean', description: 'Create JSON output', default: false },
            tor: { type: 'boolean', description: 'Use Tor for requests', default: false },
          },
        },
        commandTemplate: ['sherlock', '{{username}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Recon-ng',
      slug: 'recon-ng',
      description: 'Recon-ng is a full-featured web reconnaissance framework written in Python. It provides a powerful environment to conduct open source reconnaissance.',
      category: 'osint',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'recon-ng',
        argsSchema: {
          type: 'object',
          properties: {
            workspace: { type: 'string', description: 'Workspace name' },
            module: { type: 'string', description: 'Module to run' },
            command: { type: 'string', description: 'Command to execute' },
          },
        },
        commandTemplate: ['recon-ng', '-w', '{{workspace}}'],
        timeout: 3600,
        memoryLimit: 512,
      },
    },
    {
      name: 'SpiderFoot',
      slug: 'spiderfoot',
      description: 'SpiderFoot is an OSINT automation tool. It integrates 200+ data sources to gather intelligence about IP addresses, domains, emails, and more.',
      category: 'osint',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'spiderfoot',
        argsSchema: {
          type: 'object',
          properties: {
            scanName: { type: 'string', description: 'Name for the scan' },
            modules: { type: 'string', description: 'Modules to enable' },
            types: { type: 'string', description: 'Data types to collect' },
            maxThreads: { type: 'number', description: 'Maximum threads', default: 10 },
            strict: { type: 'boolean', description: 'Strict mode', default: false },
          },
        },
        commandTemplate: ['spiderfoot', '-s', '{{target}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'TruffleHog',
      slug: 'trufflehog',
      description: 'TruffleHog searches through git repositories for secrets using entropy and regex patterns. It finds API keys, passwords, and credentials.',
      category: 'osint',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'trufflehog',
        argsSchema: {
          type: 'object',
          properties: {
            scanType: { type: 'string', enum: ['git', 'github', 'gitlab', 's3', 'filesystem'], description: 'Type of scan', default: 'git' },
            onlyVerified: { type: 'boolean', description: 'Only show verified secrets', default: false },
            json: { type: 'boolean', description: 'JSON output', default: false },
            concurrency: { type: 'number', description: 'Number of concurrent workers', default: 1 },
            noUpdate: { type: 'boolean', description: 'Skip detector updates', default: false },
          },
        },
        commandTemplate: ['trufflehog', '{{scanType}}', '{{target}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },

    // ==================== API SECURITY TOOLS ====================
    {
      name: 'GraphQL Voyager',
      slug: 'graphql-voyager',
      description: 'GraphQL Voyager represents any GraphQL API as an interactive graph for visual exploration and security analysis of the schema.',
      category: 'api',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'graphql-voyager',
        argsSchema: {
          type: 'object',
          properties: {
            introspection: { type: 'boolean', description: 'Perform introspection query', default: true },
            headers: { type: 'string', description: 'Custom headers for requests' },
          },
        },
        commandTemplate: ['graphql-voyager', '{{target}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'Wfuzz',
      slug: 'wfuzz',
      description: 'Wfuzz is a web application fuzzer. It can brute force GET/POST parameters, directories, and more with advanced payload capabilities.',
      category: 'api',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'wfuzz',
        argsSchema: {
          type: 'object',
          properties: {
            wordlist: { type: 'string', description: 'Wordlist to use', default: '/usr/share/wordlists/dirb/common.txt' },
            threads: { type: 'number', description: 'Number of threads', default: 10 },
            cookie: { type: 'string', description: 'Cookie string' },
            headers: { type: 'string', description: 'Custom headers' },
            postData: { type: 'string', description: 'POST data' },
            hc: { type: 'string', description: 'Hide responses with these codes (comma-separated)' },
            sc: { type: 'string', description: 'Show only responses with these codes' },
            hl: { type: 'string', description: 'Hide responses with this line count' },
            hw: { type: 'string', description: 'Hide responses with this word count' },
            hh: { type: 'string', description: 'Hide responses with this char count' },
            follow: { type: 'boolean', description: 'Follow redirects', default: false },
          },
        },
        commandTemplate: ['wfuzz', '-w', '{{wordlist}}', '-t', '{{threads}}', '{{target}}/FUZZ'],
        timeout: 600,
        memoryLimit: 512,
      },
    },

    // ==================== LOCAL NETWORK SECURITY ====================
    {
      name: 'Netdiscover',
      slug: 'netdiscover',
      description: 'Active/passive ARP reconnaissance tool for discovering hosts on local networks. Useful for network mapping in switched environments where traditional ICMP scans may not work.',
      category: 'local-network',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'netdiscover',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Network interface to use (e.g., eth0, wlan0)' },
            range: { type: 'string', description: 'IP range to scan (e.g., 192.168.1.0/24)' },
            passive: { type: 'boolean', description: 'Passive mode - only sniff, no packets sent', default: false },
            count: { type: 'number', description: 'Number of ARP requests per IP', default: 1 },
            sleep: { type: 'number', description: 'Sleep time between requests (ms)', default: 0 },
          },
        },
        commandTemplate: ['netdiscover', '-i', '{{interface}}', '-r', '{{range}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Bettercap',
      slug: 'bettercap',
      description: 'Swiss army knife for network attacks and monitoring. Supports WiFi, Bluetooth LE, wireless HID hijacking, and IPv4/IPv6 network reconnaissance and MITM attacks.',
      category: 'local-network',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'bettercap',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Network interface to use' },
            caplet: { type: 'string', description: 'Caplet script to run' },
            evalCommand: { type: 'string', description: 'Command to execute at start' },
            silent: { type: 'boolean', description: 'Suppress output', default: false },
            noColors: { type: 'boolean', description: 'Disable colored output', default: false },
          },
        },
        commandTemplate: ['bettercap', '-iface', '{{interface}}', '-eval', '{{evalCommand}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Ettercap',
      slug: 'ettercap',
      description: 'Comprehensive suite for man-in-the-middle attacks on LAN. Supports active and passive dissection of protocols including SSH and HTTPS.',
      category: 'local-network',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'ettercap',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Network interface to use' },
            mode: {
              type: 'string',
              enum: ['-T', '-G', '-D'],
              enumLabels: ['Text mode (-T)', 'GTK GUI (-G)', 'Daemon mode (-D)'],
              description: 'Interface mode',
              default: '-T',
            },
            mitm: {
              type: 'string',
              enum: ['arp', 'icmp', 'dhcp', 'port', 'ndp'],
              description: 'MITM attack type',
            },
            filter: { type: 'string', description: 'Load filter from file' },
            quiet: { type: 'boolean', description: 'Quiet mode', default: false },
          },
        },
        commandTemplate: ['ettercap', '{{mode}}', '-i', '{{interface}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'MITMproxy',
      slug: 'mitmproxy',
      description: 'Interactive TLS-capable intercepting HTTP proxy for penetration testing and software development. Allows inspection and modification of traffic flows.',
      category: 'local-network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'mitmproxy',
        argsSchema: {
          type: 'object',
          properties: {
            listenHost: { type: 'string', description: 'Address to bind proxy to', default: '0.0.0.0' },
            listenPort: { type: 'number', description: 'Proxy port', default: 8080 },
            mode: {
              type: 'string',
              enum: ['regular', 'transparent', 'socks5', 'reverse', 'upstream'],
              description: 'Proxy mode',
              default: 'regular',
            },
            ssl_insecure: { type: 'boolean', description: 'Do not verify upstream SSL certificates', default: false },
            scripts: { type: 'string', description: 'Execute script (comma-separated)' },
          },
        },
        commandTemplate: ['mitmproxy', '--listen-host', '{{listenHost}}', '-p', '{{listenPort}}', '--mode', '{{mode}}'],
        timeout: 3600,
        memoryLimit: 512,
      },
    },
    {
      name: 'TCPDump',
      slug: 'tcpdump',
      description: 'Powerful command-line packet analyzer. Allows capture and display of TCP/IP packets transmitted or received over a network interface.',
      category: 'local-network',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'tcpdump',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Network interface to capture on' },
            count: { type: 'number', description: 'Exit after receiving count packets' },
            filter: { type: 'string', description: 'BPF filter expression (e.g., "port 80", "host 192.168.1.1")' },
            writeFile: { type: 'string', description: 'Write packets to pcap file' },
            verbose: { type: 'boolean', description: 'Verbose output', default: false },
            noResolve: { type: 'boolean', description: 'Do not resolve hostnames', default: true },
          },
        },
        commandTemplate: ['tcpdump', '-i', '{{interface}}', '-c', '{{count}}', '{{filter}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Wireshark CLI (tshark)',
      slug: 'tshark',
      description: 'Terminal-based Wireshark for network protocol analysis. Captures and analyzes network traffic with powerful filtering capabilities.',
      category: 'local-network',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'tshark',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Network interface to capture on' },
            captureFilter: { type: 'string', description: 'Capture filter (BPF syntax)' },
            displayFilter: { type: 'string', description: 'Display filter (Wireshark syntax)' },
            duration: { type: 'number', description: 'Stop after n seconds' },
            packets: { type: 'number', description: 'Stop after n packets' },
            outputFile: { type: 'string', description: 'Write output to file' },
            format: {
              type: 'string',
              enum: ['json', 'ek', 'pdml', 'psml', 'text'],
              description: 'Output format',
              default: 'text',
            },
          },
        },
        commandTemplate: ['tshark', '-i', '{{interface}}', '-a', 'duration:{{duration}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Hping3',
      slug: 'hping3',
      description: 'Network packet assembler/analyzer supporting TCP/IP protocols. Useful for firewall testing, port scanning, network testing using different protocols.',
      category: 'local-network',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'hping3',
        argsSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['--syn', '--ack', '--fin', '--push', '--rst', '--icmp', '--udp'],
              enumLabels: ['SYN', 'ACK', 'FIN', 'PUSH', 'RST', 'ICMP', 'UDP'],
              description: 'Packet mode',
              default: '--syn',
            },
            port: { type: 'number', description: 'Destination port' },
            count: { type: 'number', description: 'Packet count', default: 5 },
            interval: { type: 'string', description: 'Interval between packets (u1 = 1 microsecond)', default: 'u10000' },
            data: { type: 'number', description: 'Data size in bytes', default: 0 },
            flood: { type: 'boolean', description: 'Flood mode (fast as possible)', default: false },
            spoof: { type: 'string', description: 'Spoof source IP address' },
          },
        },
        commandTemplate: ['hping3', '{{mode}}', '-p', '{{port}}', '-c', '{{count}}', '{{target}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },

    // ==================== EXTERNAL NETWORK SECURITY ====================
    {
      name: 'Shodan CLI',
      slug: 'shodan',
      description: 'Command-line interface for Shodan, the search engine for Internet-connected devices. Search for exposed services, vulnerabilities, and gather intelligence on targets.',
      category: 'external-network',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'shodan',
        argsSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              enum: ['host', 'search', 'scan', 'info', 'domain', 'stats'],
              enumLabels: ['Host lookup', 'Search query', 'Scan request', 'API info', 'Domain info', 'Search stats'],
              description: 'Shodan command',
              default: 'host',
            },
            query: { type: 'string', description: 'Search query or target IP/domain' },
            limit: { type: 'number', description: 'Number of results to return', default: 10 },
            facets: { type: 'string', description: 'Facets for statistics (comma-separated)' },
            fields: { type: 'string', description: 'Fields to return (comma-separated)' },
          },
        },
        commandTemplate: ['shodan', '{{command}}', '{{query}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'Censys CLI',
      slug: 'censys',
      description: 'Search and monitor Internet-connected devices using Censys. Provides visibility into exposed services, certificates, and security posture.',
      category: 'external-network',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'censys',
        argsSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              enum: ['search', 'view', 'subdomains', 'account'],
              description: 'Censys command',
              default: 'search',
            },
            indexType: {
              type: 'string',
              enum: ['hosts', 'certificates'],
              description: 'Index type to search',
              default: 'hosts',
            },
            query: { type: 'string', description: 'Search query' },
            perPage: { type: 'number', description: 'Results per page', default: 25 },
            pages: { type: 'number', description: 'Number of pages to retrieve', default: 1 },
          },
        },
        commandTemplate: ['censys', '{{command}}', '{{indexType}}', '{{query}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'DNSRecon',
      slug: 'dnsrecon',
      description: 'Powerful DNS enumeration script. Performs zone transfers, DNS cache snooping, brute force subdomains, SRV record enumeration, and more.',
      category: 'external-network',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'dnsrecon',
        argsSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Target domain' },
            type: {
              type: 'string',
              enum: ['std', 'rvl', 'brt', 'srv', 'axfr', 'goo', 'snoop', 'tld', 'zonewalk'],
              enumLabels: ['Standard', 'Reverse', 'Brute force', 'SRV records', 'Zone transfer', 'Google', 'Cache snoop', 'TLD expansion', 'DNSSEC zone walk'],
              description: 'Enumeration type',
              default: 'std',
            },
            dictionary: { type: 'string', description: 'Dictionary file for brute force' },
            threads: { type: 'number', description: 'Number of threads', default: 10 },
            lifetime: { type: 'number', description: 'Query lifetime (seconds)', default: 3 },
            nameserver: { type: 'string', description: 'Custom nameserver' },
          },
        },
        commandTemplate: ['dnsrecon', '-d', '{{domain}}', '-t', '{{type}}', '--threads', '{{threads}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Whois',
      slug: 'whois',
      description: 'Query WHOIS databases for domain registration information. Retrieves registrant details, nameservers, registration dates, and more.',
      category: 'external-network',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'whois',
        argsSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Domain or IP to query' },
            server: { type: 'string', description: 'Specific WHOIS server to query' },
            port: { type: 'number', description: 'Custom port for WHOIS server' },
          },
        },
        commandTemplate: ['whois', '{{domain}}'],
        timeout: 60,
        memoryLimit: 128,
      },
    },
    {
      name: 'Dig',
      slug: 'dig',
      description: 'DNS lookup utility for querying DNS nameservers. Flexible tool for interrogating DNS name servers with detailed output.',
      category: 'external-network',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'dig',
        argsSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Domain to query' },
            recordType: {
              type: 'string',
              enum: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA', 'CNAME', 'PTR', 'SRV', 'ANY'],
              description: 'DNS record type',
              default: 'A',
            },
            nameserver: { type: 'string', description: 'DNS server to query (e.g., @8.8.8.8)' },
            short: { type: 'boolean', description: 'Short output (answer only)', default: false },
            trace: { type: 'boolean', description: 'Trace delegation path', default: false },
          },
        },
        commandTemplate: ['dig', '{{domain}}', '{{recordType}}'],
        timeout: 60,
        memoryLimit: 128,
      },
    },
    {
      name: 'Nslookup',
      slug: 'nslookup',
      description: 'Query Internet name servers interactively. Simple tool for DNS lookups and troubleshooting DNS problems.',
      category: 'external-network',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'nslookup',
        argsSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'Host or IP to lookup' },
            server: { type: 'string', description: 'DNS server to query' },
            type: {
              type: 'string',
              enum: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA', 'PTR', 'ANY'],
              description: 'Query type',
              default: 'A',
            },
          },
        },
        commandTemplate: ['nslookup', '-type={{type}}', '{{host}}'],
        timeout: 60,
        memoryLimit: 128,
      },
    },
    {
      name: 'Host',
      slug: 'host',
      description: 'Simple DNS lookup utility. Converts names to IP addresses and vice versa.',
      category: 'external-network',
      riskLevel: Severity.INFO,
      manifest: {
        binary: 'host',
        argsSchema: {
          type: 'object',
          properties: {
            hostname: { type: 'string', description: 'Hostname or IP to resolve' },
            type: {
              type: 'string',
              enum: ['A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA', 'PTR'],
              description: 'Query type',
            },
            server: { type: 'string', description: 'DNS server to use' },
            all: { type: 'boolean', description: 'Query all record types', default: false },
          },
        },
        commandTemplate: ['host', '{{hostname}}'],
        timeout: 60,
        memoryLimit: 128,
      },
    },

    // ==================== DATABASE SECURITY ====================
    {
      name: 'MongoDB Scanner',
      slug: 'mongodb-scanner',
      description: 'Scan for exposed MongoDB instances with default configurations. Checks for authentication bypass and data exposure.',
      category: 'database',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'mongosh',
        argsSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'MongoDB host', default: 'localhost' },
            port: { type: 'number', description: 'MongoDB port', default: 27017 },
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            authDb: { type: 'string', description: 'Authentication database', default: 'admin' },
            eval: { type: 'string', description: 'JavaScript to execute', default: 'db.adminCommand({listDatabases:1})' },
          },
        },
        commandTemplate: ['mongosh', '--host', '{{host}}', '--port', '{{port}}', '--eval', '{{eval}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'MySQL Audit',
      slug: 'mysql-audit',
      description: 'MySQL security assessment tool. Checks for misconfigurations, weak credentials, and security vulnerabilities in MySQL databases.',
      category: 'database',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'mysql',
        argsSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'MySQL host', default: 'localhost' },
            port: { type: 'number', description: 'MySQL port', default: 3306 },
            user: { type: 'string', description: 'Username' },
            password: { type: 'string', description: 'Password' },
            database: { type: 'string', description: 'Database name' },
            execute: { type: 'string', description: 'SQL command to execute', default: 'SHOW DATABASES' },
          },
        },
        commandTemplate: ['mysql', '-h', '{{host}}', '-P', '{{port}}', '-u', '{{user}}', '-e', '{{execute}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'PostgreSQL Audit',
      slug: 'postgresql-audit',
      description: 'PostgreSQL security assessment. Checks for misconfigurations, weak credentials, and security vulnerabilities in PostgreSQL databases.',
      category: 'database',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'psql',
        argsSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'PostgreSQL host', default: 'localhost' },
            port: { type: 'number', description: 'PostgreSQL port', default: 5432 },
            user: { type: 'string', description: 'Username' },
            database: { type: 'string', description: 'Database name', default: 'postgres' },
            command: { type: 'string', description: 'SQL command to execute', default: '\\l' },
          },
        },
        commandTemplate: ['psql', '-h', '{{host}}', '-p', '{{port}}', '-U', '{{user}}', '-d', '{{database}}', '-c', '{{command}}'],
        timeout: 120,
        memoryLimit: 256,
      },
    },
    {
      name: 'Redis Scanner',
      slug: 'redis-scanner',
      description: 'Scan for exposed Redis instances. Checks for authentication bypass, dangerous commands, and potential data exposure.',
      category: 'database',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'redis-cli',
        argsSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'Redis host', default: 'localhost' },
            port: { type: 'number', description: 'Redis port', default: 6379 },
            password: { type: 'string', description: 'Redis password' },
            command: { type: 'string', description: 'Redis command to execute', default: 'INFO' },
          },
        },
        commandTemplate: ['redis-cli', '-h', '{{host}}', '-p', '{{port}}', '{{command}}'],
        timeout: 60,
        memoryLimit: 128,
      },
    },
    {
      name: 'MSSQL Audit',
      slug: 'mssql-audit',
      description: 'Microsoft SQL Server security assessment. Uses Impacket mssqlclient for enumeration and exploitation of MSSQL servers.',
      category: 'database',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'mssqlclient.py',
        argsSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Target (user:password@host or domain/user:password@host)' },
            port: { type: 'number', description: 'MSSQL port', default: 1433 },
            windows_auth: { type: 'boolean', description: 'Use Windows authentication', default: false },
            database: { type: 'string', description: 'Database instance', default: 'master' },
            file: { type: 'string', description: 'SQL file to execute' },
          },
        },
        commandTemplate: ['mssqlclient.py', '{{target}}', '-port', '{{port}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Oracle Audit',
      slug: 'oracle-audit',
      description: 'Oracle database security scanner. Uses odat (Oracle Database Attacking Tool) for comprehensive Oracle security assessment.',
      category: 'database',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'odat',
        argsSchema: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              enum: ['all', 'sidguesser', 'passwordguesser', 'tnspoison', 'ctxsys', 'dbmsadvisor', 'utlhttp', 'utltcp', 'dbmsscheduler', 'externaltable', 'dbmslob', 'stealremotepwds'],
              description: 'Attack module',
              default: 'all',
            },
            server: { type: 'string', description: 'Oracle server hostname/IP' },
            port: { type: 'number', description: 'Oracle port', default: 1521 },
            sid: { type: 'string', description: 'Oracle SID' },
            user: { type: 'string', description: 'Username' },
            password: { type: 'string', description: 'Password' },
          },
        },
        commandTemplate: ['odat', '{{module}}', '-s', '{{server}}', '-p', '{{port}}', '-d', '{{sid}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },

    // ==================== AWS SECURITY ====================
    {
      name: 'Prowler AWS',
      slug: 'prowler-aws',
      description: 'AWS Security Best Practices Assessment. Performs 300+ checks covering CIS, PCI-DSS, HIPAA, GDPR, and AWS best practices.',
      category: 'aws',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'prowler',
        argsSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'Cloud provider', default: 'aws' },
            profile: { type: 'string', description: 'AWS profile name' },
            region: { type: 'string', description: 'AWS region (or "all")', default: 'us-east-1' },
            checks: { type: 'string', description: 'Specific checks to run (comma-separated)' },
            compliance: {
              type: 'string',
              enum: ['cis_1.4_aws', 'cis_1.5_aws', 'cis_2.0_aws', 'pci_3.2.1_aws', 'hipaa_aws', 'gdpr_aws', 'soc2_aws'],
              description: 'Compliance framework',
            },
            services: { type: 'string', description: 'Services to audit (comma-separated)' },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low', 'informational'],
              description: 'Minimum severity to report',
            },
            outputFormats: { type: 'string', description: 'Output formats (json, csv, html)', default: 'json' },
          },
        },
        commandTemplate: ['prowler', '{{provider}}', '-r', '{{region}}', '-M', '{{outputFormats}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'ScoutSuite AWS',
      slug: 'scoutsuite-aws',
      description: 'Multi-cloud security auditing tool for AWS. Gathers configuration data and highlights risk areas across AWS services.',
      category: 'aws',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'scout',
        argsSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'Cloud provider', default: 'aws' },
            profile: { type: 'string', description: 'AWS profile name' },
            regions: { type: 'string', description: 'AWS regions (comma-separated)' },
            services: { type: 'string', description: 'Services to scan (comma-separated)' },
            rulesets: { type: 'string', description: 'Custom ruleset file' },
            reportDir: { type: 'string', description: 'Output directory for reports' },
            noSsl: { type: 'boolean', description: 'Disable SSL verification', default: false },
          },
        },
        commandTemplate: ['scout', '{{provider}}', '--profile', '{{profile}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Pacu',
      slug: 'pacu',
      description: 'AWS exploitation framework for testing security of Amazon Web Services environments. Includes modules for credential harvesting, privilege escalation, and data exfiltration.',
      category: 'aws',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'pacu',
        argsSchema: {
          type: 'object',
          properties: {
            session: { type: 'string', description: 'Pacu session name' },
            module: {
              type: 'string',
              description: 'Module to run (e.g., iam__enum_permissions, ec2__enum)',
            },
            regions: { type: 'string', description: 'AWS regions (comma-separated)' },
            execCommand: { type: 'string', description: 'Command to execute in Pacu' },
          },
        },
        commandTemplate: ['pacu', '--session', '{{session}}', '--exec', '{{execCommand}}'],
        timeout: 1800,
        memoryLimit: 512,
      },
    },
    {
      name: 'CloudMapper',
      slug: 'cloudmapper',
      description: 'Analyze AWS environments. Creates network diagrams, identifies publicly exposed resources, and detects security issues.',
      category: 'aws',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'cloudmapper',
        argsSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              enum: ['collect', 'prepare', 'report', 'audit', 'webserver', 'public'],
              description: 'CloudMapper command',
              default: 'collect',
            },
            account: { type: 'string', description: 'AWS account name in config' },
            regions: { type: 'string', description: 'AWS regions (comma-separated)', default: 'all' },
            profile: { type: 'string', description: 'AWS profile name' },
          },
        },
        commandTemplate: ['cloudmapper', '{{command}}', '--account', '{{account}}'],
        timeout: 1800,
        memoryLimit: 1024,
      },
    },
    {
      name: 'S3Scanner',
      slug: 's3scanner',
      description: 'Scan for open S3 buckets and dump their contents. Identifies misconfigured S3 buckets with public access.',
      category: 'aws',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 's3scanner',
        argsSchema: {
          type: 'object',
          properties: {
            buckets: { type: 'string', description: 'Bucket names to check (comma-separated or file)' },
            dump: { type: 'boolean', description: 'Dump bucket contents', default: false },
            dumpDir: { type: 'string', description: 'Directory to dump contents to' },
            threads: { type: 'number', description: 'Number of threads', default: 4 },
          },
        },
        commandTemplate: ['s3scanner', '--buckets', '{{buckets}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'AWS CLI',
      slug: 'aws-cli',
      description: 'Official AWS command-line interface. Direct access to AWS services for enumeration, configuration review, and security assessment.',
      category: 'aws',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'aws',
        argsSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              enum: ['iam', 's3', 'ec2', 'rds', 'lambda', 'sts', 'secretsmanager', 'ssm', 'cloudtrail', 'config', 'guardduty', 'securityhub'],
              description: 'AWS service',
            },
            command: { type: 'string', description: 'Service command (e.g., list-users, describe-instances)' },
            profile: { type: 'string', description: 'AWS profile name' },
            region: { type: 'string', description: 'AWS region' },
            output: {
              type: 'string',
              enum: ['json', 'text', 'table', 'yaml'],
              description: 'Output format',
              default: 'json',
            },
            query: { type: 'string', description: 'JMESPath query for filtering' },
          },
        },
        commandTemplate: ['aws', '{{service}}', '{{command}}', '--output', '{{output}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },

    // ==================== AZURE SECURITY ====================
    {
      name: 'Prowler Azure',
      slug: 'prowler-azure',
      description: 'Azure Security Best Practices Assessment. Performs comprehensive security checks covering CIS Azure Foundations Benchmark.',
      category: 'azure',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'prowler',
        argsSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'Cloud provider', default: 'azure' },
            subscriptionIds: { type: 'string', description: 'Azure subscription IDs (comma-separated)' },
            compliance: {
              type: 'string',
              enum: ['cis_1.5_azure', 'cis_2.0_azure'],
              description: 'Compliance framework',
            },
            services: { type: 'string', description: 'Services to audit (comma-separated)' },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low', 'informational'],
              description: 'Minimum severity to report',
            },
            outputFormats: { type: 'string', description: 'Output formats (json, csv, html)', default: 'json' },
          },
        },
        commandTemplate: ['prowler', 'azure', '-M', '{{outputFormats}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'ScoutSuite Azure',
      slug: 'scoutsuite-azure',
      description: 'Multi-cloud security auditing tool for Azure. Analyzes security configuration and highlights risk areas.',
      category: 'azure',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'scout',
        argsSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'Cloud provider', default: 'azure' },
            clientId: { type: 'string', description: 'Azure client ID' },
            tenantId: { type: 'string', description: 'Azure tenant ID' },
            subscriptionId: { type: 'string', description: 'Azure subscription ID' },
            allSubscriptions: { type: 'boolean', description: 'Scan all subscriptions', default: false },
            services: { type: 'string', description: 'Services to scan (comma-separated)' },
            reportDir: { type: 'string', description: 'Output directory for reports' },
          },
        },
        commandTemplate: ['scout', 'azure', '--tenant-id', '{{tenantId}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Azure CLI',
      slug: 'azure-cli',
      description: 'Official Azure command-line interface. Direct access to Azure services for security enumeration and assessment.',
      category: 'azure',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'az',
        argsSchema: {
          type: 'object',
          properties: {
            group: {
              type: 'string',
              enum: ['ad', 'account', 'vm', 'storage', 'network', 'keyvault', 'sql', 'monitor', 'security', 'role', 'policy'],
              description: 'Azure service group',
            },
            command: { type: 'string', description: 'Command to execute (e.g., list, show)' },
            subscription: { type: 'string', description: 'Subscription ID or name' },
            resourceGroup: { type: 'string', description: 'Resource group name' },
            output: {
              type: 'string',
              enum: ['json', 'table', 'tsv', 'yaml'],
              description: 'Output format',
              default: 'json',
            },
            query: { type: 'string', description: 'JMESPath query for filtering' },
          },
        },
        commandTemplate: ['az', '{{group}}', '{{command}}', '-o', '{{output}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'ROADtools',
      slug: 'roadtools',
      description: 'Azure AD exploration framework. Gathers data from Azure AD using the ROADrecon tool for analysis and exploitation.',
      category: 'azure',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'roadrecon',
        argsSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              enum: ['auth', 'gather', 'dump', 'plugin', 'gui'],
              description: 'ROADrecon command',
              default: 'gather',
            },
            authMethod: {
              type: 'string',
              enum: ['device', 'password', 'prt'],
              description: 'Authentication method',
            },
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            tenant: { type: 'string', description: 'Azure tenant ID' },
          },
        },
        commandTemplate: ['roadrecon', '{{command}}'],
        timeout: 1800,
        memoryLimit: 512,
      },
    },
    {
      name: 'AzureHound',
      slug: 'azurehound',
      description: 'Azure Active Directory data collector for BloodHound. Maps attack paths and identifies privilege escalation opportunities in Azure AD.',
      category: 'azure',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'azurehound',
        argsSchema: {
          type: 'object',
          properties: {
            tenant: { type: 'string', description: 'Azure tenant ID or domain' },
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            outputFile: { type: 'string', description: 'Output file path', default: 'azurehound.json' },
            listAll: { type: 'boolean', description: 'Collect all available data', default: true },
          },
        },
        commandTemplate: ['azurehound', '-t', '{{tenant}}', '-o', '{{outputFile}}'],
        timeout: 1800,
        memoryLimit: 512,
      },
    },

    // ==================== GCP SECURITY ====================
    {
      name: 'Prowler GCP',
      slug: 'prowler-gcp',
      description: 'GCP Security Best Practices Assessment. Performs comprehensive security checks covering CIS Google Cloud Platform Benchmark.',
      category: 'gcp',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'prowler',
        argsSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'Cloud provider', default: 'gcp' },
            projectIds: { type: 'string', description: 'GCP project IDs (comma-separated)' },
            compliance: {
              type: 'string',
              enum: ['cis_1.2_gcp', 'cis_2.0_gcp'],
              description: 'Compliance framework',
            },
            services: { type: 'string', description: 'Services to audit (comma-separated)' },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low', 'informational'],
              description: 'Minimum severity to report',
            },
            outputFormats: { type: 'string', description: 'Output formats (json, csv, html)', default: 'json' },
          },
        },
        commandTemplate: ['prowler', 'gcp', '-M', '{{outputFormats}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'ScoutSuite GCP',
      slug: 'scoutsuite-gcp',
      description: 'Multi-cloud security auditing tool for GCP. Analyzes security configuration of Google Cloud Platform resources.',
      category: 'gcp',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'scout',
        argsSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', description: 'Cloud provider', default: 'gcp' },
            projectId: { type: 'string', description: 'GCP project ID' },
            allProjects: { type: 'boolean', description: 'Scan all accessible projects', default: false },
            services: { type: 'string', description: 'Services to scan (comma-separated)' },
            reportDir: { type: 'string', description: 'Output directory for reports' },
            userAccount: { type: 'boolean', description: 'Use user account authentication', default: true },
          },
        },
        commandTemplate: ['scout', 'gcp', '--project-id', '{{projectId}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'GCP CLI (gcloud)',
      slug: 'gcloud',
      description: 'Official Google Cloud CLI. Direct access to GCP services for security enumeration and configuration assessment.',
      category: 'gcp',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'gcloud',
        argsSchema: {
          type: 'object',
          properties: {
            group: {
              type: 'string',
              enum: ['compute', 'storage', 'iam', 'sql', 'container', 'functions', 'logging', 'projects', 'secrets', 'kms'],
              description: 'GCP service group',
            },
            command: { type: 'string', description: 'Command to execute (e.g., list, describe)' },
            project: { type: 'string', description: 'GCP project ID' },
            format: {
              type: 'string',
              enum: ['json', 'table', 'csv', 'yaml'],
              description: 'Output format',
              default: 'json',
            },
            filter: { type: 'string', description: 'Filter expression' },
          },
        },
        commandTemplate: ['gcloud', '{{group}}', '{{command}}', '--format={{format}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'GCPBucketBrute',
      slug: 'gcpbucketbrute',
      description: 'Enumerate Google Storage buckets for a given domain. Identifies misconfigured and publicly accessible GCP buckets.',
      category: 'gcp',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'gcpbucketbrute',
        argsSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string', description: 'Keyword to use for bucket name generation' },
            wordlist: { type: 'string', description: 'Wordlist file for bucket name permutations' },
            threads: { type: 'number', description: 'Number of threads', default: 5 },
            outputFile: { type: 'string', description: 'Output file for results' },
          },
        },
        commandTemplate: ['gcpbucketbrute', '-k', '{{keyword}}', '-t', '{{threads}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },

    // ==================== ACTIVE DIRECTORY SECURITY ====================
    {
      name: 'BloodHound',
      slug: 'bloodhound',
      description: 'Active Directory reconnaissance tool that reveals hidden relationships and attack paths. Uses graph theory to map AD environments and identify privilege escalation paths.',
      category: 'active-directory',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'bloodhound-python',
        argsSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Target domain' },
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            dc: { type: 'string', description: 'Domain controller IP/hostname' },
            collectionMethod: {
              type: 'string',
              enum: ['All', 'Default', 'Group', 'LocalAdmin', 'Session', 'Trusts', 'ACL', 'Container', 'RDP', 'DCOM', 'PSRemote', 'DCOnly'],
              description: 'Collection method',
              default: 'All',
            },
            stealth: { type: 'boolean', description: 'Stealth mode (slower but stealthier)', default: false },
            outputPrefix: { type: 'string', description: 'Prefix for output files' },
          },
        },
        commandTemplate: ['bloodhound-python', '-u', '{{username}}', '-p', '{{password}}', '-d', '{{domain}}', '-c', '{{collectionMethod}}'],
        timeout: 3600,
        memoryLimit: 1024,
      },
    },
    {
      name: 'Impacket GetUserSPNs',
      slug: 'getuserspns',
      description: 'Kerberoasting attack tool. Queries Active Directory for user accounts with SPNs set and retrieves TGS tickets for offline cracking.',
      category: 'active-directory',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'GetUserSPNs.py',
        argsSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Domain/username:password or domain/username (e.g., DOMAIN/user:password)' },
            dc: { type: 'string', description: 'Domain controller IP (-dc-ip)' },
            request: { type: 'boolean', description: 'Request TGS tickets', default: true },
            outputFile: { type: 'string', description: 'Output file for hashes' },
            usersFile: { type: 'string', description: 'File with usernames to query' },
            hashes: { type: 'string', description: 'NTLM hash for authentication (LM:NT)' },
          },
        },
        commandTemplate: ['GetUserSPNs.py', '{{target}}', '-dc-ip', '{{dc}}', '-request'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Impacket GetNPUsers',
      slug: 'getnpusers',
      description: 'AS-REP Roasting attack tool. Queries for user accounts with Kerberos pre-authentication disabled to retrieve AS-REP hashes for offline cracking.',
      category: 'active-directory',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'GetNPUsers.py',
        argsSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Domain/username or domain/ (e.g., DOMAIN/ for all users)' },
            dc: { type: 'string', description: 'Domain controller IP (-dc-ip)' },
            usersFile: { type: 'string', description: 'File with usernames to query' },
            outputFile: { type: 'string', description: 'Output file for hashes' },
            format: {
              type: 'string',
              enum: ['hashcat', 'john'],
              description: 'Hash output format',
              default: 'hashcat',
            },
            noPass: { type: 'boolean', description: 'Dont prompt for password (anonymous)', default: false },
          },
        },
        commandTemplate: ['GetNPUsers.py', '{{target}}', '-dc-ip', '{{dc}}', '-format', '{{format}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Impacket secretsdump',
      slug: 'secretsdump',
      description: 'Extract credentials from Windows systems. Dumps SAM, LSA secrets, cached credentials, and domain controller NTDS.dit.',
      category: 'active-directory',
      riskLevel: Severity.CRITICAL,
      manifest: {
        binary: 'secretsdump.py',
        argsSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Target (domain/user:password@host or user:password@host)' },
            dc: { type: 'string', description: 'Domain controller IP for DCSync' },
            justDc: { type: 'boolean', description: 'Extract only NTDS.DIT data (DCSync)', default: false },
            justDcUser: { type: 'string', description: 'Specific user to extract (DCSync)' },
            sam: { type: 'boolean', description: 'Extract SAM database', default: false },
            lsa: { type: 'boolean', description: 'Extract LSA secrets', default: false },
            ntds: { type: 'string', description: 'Path to NTDS.DIT file' },
            system: { type: 'string', description: 'Path to SYSTEM hive' },
            outputFile: { type: 'string', description: 'Output file for credentials' },
          },
        },
        commandTemplate: ['secretsdump.py', '{{target}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'CrackMapExec',
      slug: 'crackmapexec',
      description: 'Swiss army knife for pentesting Windows/Active Directory environments. Supports multiple protocols including SMB, WinRM, SSH, LDAP, MSSQL.',
      category: 'active-directory',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'crackmapexec',
        argsSchema: {
          type: 'object',
          properties: {
            protocol: {
              type: 'string',
              enum: ['smb', 'winrm', 'ssh', 'ldap', 'mssql', 'rdp'],
              description: 'Protocol to use',
              default: 'smb',
            },
            target: { type: 'string', description: 'Target IP, range, or CIDR' },
            username: { type: 'string', description: 'Username for authentication' },
            password: { type: 'string', description: 'Password for authentication' },
            hash: { type: 'string', description: 'NTLM hash for pass-the-hash' },
            domain: { type: 'string', description: 'Domain name' },
            localAuth: { type: 'boolean', description: 'Use local authentication', default: false },
            module: { type: 'string', description: 'Module to execute' },
            shares: { type: 'boolean', description: 'Enumerate shares', default: false },
            sessions: { type: 'boolean', description: 'Enumerate sessions', default: false },
            users: { type: 'boolean', description: 'Enumerate users', default: false },
            groups: { type: 'boolean', description: 'Enumerate groups', default: false },
          },
        },
        commandTemplate: ['crackmapexec', '{{protocol}}', '{{target}}', '-u', '{{username}}', '-p', '{{password}}'],
        timeout: 600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Kerbrute',
      slug: 'kerbrute',
      description: 'Tool to perform Kerberos pre-auth bruteforcing. Useful for username enumeration and password spraying against Active Directory.',
      category: 'active-directory',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'kerbrute',
        argsSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['userenum', 'passwordspray', 'bruteuser', 'bruteforce'],
              enumLabels: ['Username Enumeration', 'Password Spray', 'Brute Force User', 'Full Brute Force'],
              description: 'Attack mode',
              default: 'userenum',
            },
            domain: { type: 'string', description: 'Target domain' },
            dc: { type: 'string', description: 'Domain controller IP' },
            users: { type: 'string', description: 'Username wordlist file' },
            passwords: { type: 'string', description: 'Password wordlist file' },
            threads: { type: 'number', description: 'Number of threads', default: 10 },
            outputFile: { type: 'string', description: 'Output file for results' },
          },
        },
        commandTemplate: ['kerbrute', '{{mode}}', '-d', '{{domain}}', '--dc', '{{dc}}', '{{users}}'],
        timeout: 1800,
        memoryLimit: 256,
      },
    },
    {
      name: 'LDAPSearch',
      slug: 'ldapsearch',
      description: 'LDAP query tool for Active Directory enumeration. Query user accounts, groups, computers, and other AD objects.',
      category: 'active-directory',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'ldapsearch',
        argsSchema: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'LDAP server hostname/IP' },
            baseDn: { type: 'string', description: 'Base DN for search (e.g., DC=domain,DC=local)' },
            bindDn: { type: 'string', description: 'Bind DN (user to authenticate as)' },
            password: { type: 'string', description: 'Password for authentication' },
            filter: { type: 'string', description: 'LDAP filter (e.g., (objectClass=user))', default: '(objectClass=*)' },
            attributes: { type: 'string', description: 'Attributes to return (space-separated)' },
            scope: {
              type: 'string',
              enum: ['base', 'one', 'sub'],
              description: 'Search scope',
              default: 'sub',
            },
          },
        },
        commandTemplate: ['ldapsearch', '-H', 'ldap://{{host}}', '-b', '{{baseDn}}', '-D', '{{bindDn}}', '-w', '{{password}}', '{{filter}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Rubeus',
      slug: 'rubeus',
      description: 'Kerberos abuse toolkit. Supports ticket requests, renewals, S4U, AS-REP roasting, Kerberoasting, and pass-the-ticket attacks.',
      category: 'active-directory',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'rubeus',
        argsSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['kerberoast', 'asreproast', 'dump', 'tgtdeleg', 'monitor', 'harvest', 's4u', 'ptt', 'purge', 'describe'],
              description: 'Rubeus action to perform',
            },
            user: { type: 'string', description: 'Target username' },
            domain: { type: 'string', description: 'Target domain' },
            dc: { type: 'string', description: 'Domain controller' },
            format: {
              type: 'string',
              enum: ['hashcat', 'john'],
              description: 'Hash output format',
              default: 'hashcat',
            },
            outfile: { type: 'string', description: 'Output file' },
          },
        },
        commandTemplate: ['rubeus', '{{action}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },

    // ==================== WIRELESS SECURITY ====================
    {
      name: 'Aircrack-ng',
      slug: 'aircrack-ng',
      description: 'WiFi security auditing tool suite. Capable of monitoring, attacking, testing, and cracking WiFi networks.',
      category: 'wireless',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'aircrack-ng',
        argsSchema: {
          type: 'object',
          properties: {
            capFile: { type: 'string', description: 'Capture file (.cap) to crack' },
            wordlist: { type: 'string', description: 'Password wordlist file' },
            bssid: { type: 'string', description: 'Target BSSID (MAC address)' },
            essid: { type: 'string', description: 'Target ESSID (network name)' },
          },
        },
        commandTemplate: ['aircrack-ng', '-w', '{{wordlist}}', '-b', '{{bssid}}', '{{capFile}}'],
        timeout: 3600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Airodump-ng',
      slug: 'airodump-ng',
      description: 'Wireless packet capture tool. Captures raw 802.11 frames for analysis and WEP/WPA key cracking.',
      category: 'wireless',
      riskLevel: Severity.MEDIUM,
      manifest: {
        binary: 'airodump-ng',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Wireless interface in monitor mode' },
            bssid: { type: 'string', description: 'Filter by BSSID' },
            channel: { type: 'number', description: 'Channel to monitor' },
            write: { type: 'string', description: 'Output file prefix' },
            band: {
              type: 'string',
              enum: ['a', 'b', 'g', 'abg'],
              description: 'Band to scan',
              default: 'abg',
            },
            ivs: { type: 'boolean', description: 'Save only IVs', default: false },
          },
        },
        commandTemplate: ['airodump-ng', '-c', '{{channel}}', '--bssid', '{{bssid}}', '-w', '{{write}}', '{{interface}}'],
        timeout: 600,
        memoryLimit: 256,
      },
    },
    {
      name: 'Aireplay-ng',
      slug: 'aireplay-ng',
      description: 'Wireless packet injection tool. Generates traffic for WEP/WPA cracking through deauthentication and other attacks.',
      category: 'wireless',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'aireplay-ng',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Wireless interface in monitor mode' },
            attack: {
              type: 'string',
              enum: ['-0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-9'],
              enumLabels: ['Deauth', 'Fake Auth', 'Interactive', 'ARP Replay', 'Chopchop', 'Fragment', 'Cafe Latte', 'Client Frag', 'Injection Test'],
              description: 'Attack mode',
              default: '-0',
            },
            count: { type: 'number', description: 'Number of packets to send (0=infinite)', default: 5 },
            bssid: { type: 'string', description: 'Target BSSID' },
            station: { type: 'string', description: 'Target station MAC address' },
          },
        },
        commandTemplate: ['aireplay-ng', '{{attack}}', '{{count}}', '-a', '{{bssid}}', '-c', '{{station}}', '{{interface}}'],
        timeout: 300,
        memoryLimit: 256,
      },
    },
    {
      name: 'Wifite',
      slug: 'wifite',
      description: 'Automated wireless network auditor. Automates the process of capturing and cracking WEP, WPA, and WPS.',
      category: 'wireless',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'wifite',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Wireless interface' },
            kill: { type: 'boolean', description: 'Kill interfering processes', default: true },
            wpa: { type: 'boolean', description: 'Only target WPA networks', default: false },
            wep: { type: 'boolean', description: 'Only target WEP networks', default: false },
            wps: { type: 'boolean', description: 'Only target WPS networks', default: false },
            bssid: { type: 'string', description: 'Target specific BSSID' },
            essid: { type: 'string', description: 'Target specific ESSID' },
            channel: { type: 'number', description: 'Target specific channel' },
            dict: { type: 'string', description: 'Wordlist for WPA cracking' },
          },
        },
        commandTemplate: ['wifite', '-i', '{{interface}}', '--kill'],
        timeout: 3600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Reaver',
      slug: 'reaver',
      description: 'WPS PIN brute force attack tool. Exploits WPS vulnerability to recover WPA/WPA2 passphrases.',
      category: 'wireless',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'reaver',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Wireless interface in monitor mode' },
            bssid: { type: 'string', description: 'Target BSSID' },
            channel: { type: 'number', description: 'Target channel' },
            delay: { type: 'number', description: 'Delay between PIN attempts (seconds)', default: 1 },
            lockDelay: { type: 'number', description: 'Delay on WPS lock (seconds)', default: 60 },
            verbose: { type: 'boolean', description: 'Verbose output', default: true },
            pin: { type: 'string', description: 'Start at specific PIN' },
          },
        },
        commandTemplate: ['reaver', '-i', '{{interface}}', '-b', '{{bssid}}', '-c', '{{channel}}', '-vv'],
        timeout: 86400,
        memoryLimit: 256,
      },
    },
    {
      name: 'Kismet',
      slug: 'kismet',
      description: 'Wireless network detector, sniffer, and intrusion detection system. Passive network discovery tool for WiFi, Bluetooth, and SDR.',
      category: 'wireless',
      riskLevel: Severity.LOW,
      manifest: {
        binary: 'kismet',
        argsSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Capture source (e.g., wlan0)' },
            logTypes: { type: 'string', description: 'Log types (comma-separated)', default: 'kismet,pcapng' },
            logPrefix: { type: 'string', description: 'Log file prefix' },
            noLogging: { type: 'boolean', description: 'Disable logging', default: false },
            daemon: { type: 'boolean', description: 'Run as daemon', default: false },
          },
        },
        commandTemplate: ['kismet', '-c', '{{source}}', '--log-types', '{{logTypes}}'],
        timeout: 3600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Fern WiFi Cracker CLI',
      slug: 'fern-wifi',
      description: 'Wireless security auditing and attack software. Automates WEP/WPA/WPS cracking with GUI and CLI support.',
      category: 'wireless',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'fern-wifi-cracker',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Wireless interface' },
            attack: {
              type: 'string',
              enum: ['wep', 'wpa', 'wps'],
              description: 'Attack type',
            },
          },
        },
        commandTemplate: ['fern-wifi-cracker'],
        timeout: 3600,
        memoryLimit: 512,
      },
    },
    {
      name: 'Bully',
      slug: 'bully',
      description: 'WPS brute force attack implementation. Alternative to Reaver for WPS PIN recovery.',
      category: 'wireless',
      riskLevel: Severity.HIGH,
      manifest: {
        binary: 'bully',
        argsSchema: {
          type: 'object',
          properties: {
            interface: { type: 'string', description: 'Wireless interface in monitor mode' },
            bssid: { type: 'string', description: 'Target BSSID' },
            channel: { type: 'number', description: 'Target channel' },
            lockwait: { type: 'number', description: 'Seconds to wait when AP locks', default: 43 },
            pin: { type: 'string', description: 'Starting or known PIN' },
            bruteforce: { type: 'boolean', description: 'Use brute force', default: true },
          },
        },
        commandTemplate: ['bully', '-b', '{{bssid}}', '-c', '{{channel}}', '{{interface}}'],
        timeout: 86400,
        memoryLimit: 256,
      },
    },
  ];

  for (const tool of tools) {
    const category = await prisma.toolCategory.findUnique({
      where: { slug: tool.category },
    });

    if (!category) continue;

    const createdTool = await prisma.tool.upsert({
      where: { slug: tool.slug },
      update: {
        name: tool.name,
        description: tool.description,
        riskLevel: tool.riskLevel,
      },
      create: {
        name: tool.name,
        slug: tool.slug,
        description: tool.description,
        categoryId: category.id,
        riskLevel: tool.riskLevel,
      },
    });

    // Create manifest version
    const existingManifest = await prisma.toolManifestVersion.findFirst({
      where: { toolId: createdTool.id },
      orderBy: { version: 'desc' },
    });

    if (!existingManifest) {
      await prisma.toolManifestVersion.create({
        data: {
          toolId: createdTool.id,
          version: 1,
          binary: tool.manifest.binary,
          argsSchema: tool.manifest.argsSchema,
          commandTemplate: tool.manifest.commandTemplate,
          timeout: tool.manifest.timeout,
          memoryLimit: tool.manifest.memoryLimit,
          isActive: true,
        },
      });
    }
  }
  console.log(`✅ Created ${tools.length} tools with manifests`);

  // Create AI Agents
  const agents = [
    {
      name: 'Intelligent Decision Engine',
      slug: 'decision-engine',
      type: AgentType.DECISION_ENGINE,
      description: 'The core AI agent that analyzes targets, selects appropriate tools, optimizes parameters, and orchestrates multi-tool workflows. It uses context awareness to make intelligent decisions about scan order and intensity.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        temperature: 0.3,
        contextWindow: 200000,
      },
      capabilities: [
        'Tool selection and parameter optimization',
        'Multi-tool workflow orchestration',
        'Context-aware decision making',
        'Risk assessment and prioritization',
        'Adaptive scan intensity',
      ],
    },
    {
      name: 'Bug Bounty Workflow Manager',
      slug: 'bug-bounty',
      type: AgentType.BUG_BOUNTY,
      description: 'Specialized agent for bug bounty hunting. It automates reconnaissance, identifies potential vulnerabilities, manages scope compliance, and generates professional reports for bug bounty submissions.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        workflowTemplates: ['recon-full', 'webapp-deep', 'api-audit'],
      },
      capabilities: [
        'Automated reconnaissance workflows',
        'Scope compliance verification',
        'Vulnerability prioritization',
        'Report generation for submissions',
        'Duplicate detection',
        'CVSS scoring assistance',
      ],
    },
    {
      name: 'CTF Challenge Solver',
      slug: 'ctf-solver',
      type: AgentType.CTF_SOLVER,
      description: 'Expert agent for Capture The Flag competitions. It analyzes challenges, suggests approaches for crypto, forensics, web, and binary exploitation categories, and assists with flag extraction.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        categories: ['crypto', 'forensics', 'web', 'pwn', 'reverse', 'misc'],
      },
      capabilities: [
        'Challenge category identification',
        'Multi-step solution planning',
        'Cryptographic analysis',
        'Binary exploitation guidance',
        'Steganography detection',
        'Flag format recognition',
      ],
    },
    {
      name: 'CVE Intelligence Manager',
      slug: 'cve-intelligence',
      type: AgentType.CVE_INTELLIGENCE,
      description: 'Monitors and analyzes CVE data to identify relevant vulnerabilities for targets. It correlates discovered services with known CVEs and provides exploitation guidance and remediation advice.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        sources: ['nvd', 'cvedetails', 'exploit-db', 'vulndb'],
      },
      capabilities: [
        'CVE correlation with discovered services',
        'Exploit availability checking',
        'CVSS analysis and scoring',
        'Remediation recommendations',
        'Zero-day monitoring',
        'Vendor advisory tracking',
      ],
    },
    {
      name: 'AI Exploit Generator',
      slug: 'exploit-generator',
      type: AgentType.EXPLOIT_GENERATOR,
      description: 'Generates proof-of-concept exploits based on discovered vulnerabilities. It creates safe, controlled exploit code with proper safeguards and documentation for authorized testing.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        safeMode: true,
        requireAuthorization: true,
      },
      capabilities: [
        'PoC exploit generation',
        'Payload customization',
        'Encoding and obfuscation',
        'Safe testing guidelines',
        'Exploitation documentation',
      ],
    },
    {
      name: 'Vulnerability Correlator',
      slug: 'vuln-correlator',
      type: AgentType.VULNERABILITY_CORRELATOR,
      description: 'Analyzes findings from multiple tools to identify attack chains and correlate vulnerabilities. It discovers paths from initial access to critical assets and prioritizes remediation.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
      },
      capabilities: [
        'Attack chain discovery',
        'Multi-vulnerability correlation',
        'Lateral movement path analysis',
        'Privilege escalation identification',
        'Business impact assessment',
        'Remediation prioritization',
      ],
    },
    {
      name: 'Technology Detector',
      slug: 'tech-detector',
      type: AgentType.TECHNOLOGY_DETECTOR,
      description: 'Identifies technology stacks, frameworks, and configurations from scan results. It fingerprints applications, detects version information, and suggests targeted testing approaches.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 2048,
      },
      capabilities: [
        'Technology stack identification',
        'Version fingerprinting',
        'Framework detection',
        'Configuration analysis',
        'Attack surface mapping',
        'Testing approach recommendations',
      ],
    },
    {
      name: 'Rate Limit Detector',
      slug: 'rate-limit-detector',
      type: AgentType.RATE_LIMIT_DETECTOR,
      description: 'Monitors scan activity and detects rate limiting, WAF blocks, and other defensive measures. It adjusts scan parameters automatically to maintain effectiveness while avoiding detection.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        monitoringInterval: 1000,
      },
      capabilities: [
        'Rate limit detection',
        'WAF fingerprinting',
        'Automatic throttling',
        'Evasion technique suggestions',
        'Block recovery strategies',
      ],
    },
    {
      name: 'Failure Recovery System',
      slug: 'failure-recovery',
      type: AgentType.FAILURE_RECOVERY,
      description: 'Handles errors, timeouts, and failures during scanning. It implements retry logic, alternative approaches, and graceful degradation to ensure scan completion.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        maxRetries: 3,
        backoffMultiplier: 2,
      },
      capabilities: [
        'Automatic retry with backoff',
        'Alternative tool selection',
        'Partial result recovery',
        'Error classification',
        'Graceful degradation',
      ],
    },
    {
      name: 'Performance Monitor',
      slug: 'performance-monitor',
      type: AgentType.PERFORMANCE_MONITOR,
      description: 'Monitors system resources, scan performance, and optimization opportunities. It tracks metrics, identifies bottlenecks, and suggests performance improvements.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        sampleInterval: 5000,
      },
      capabilities: [
        'Resource utilization tracking',
        'Bottleneck identification',
        'Scan time optimization',
        'Concurrency management',
        'Memory usage optimization',
      ],
    },
    {
      name: 'Parameter Optimizer',
      slug: 'parameter-optimizer',
      type: AgentType.PARAMETER_OPTIMIZER,
      description: 'Analyzes scan contexts and optimizes tool parameters for best results. It learns from previous scans and adjusts parameters based on target characteristics.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 2048,
        learningEnabled: true,
      },
      capabilities: [
        'Context-aware parameter tuning',
        'Historical performance analysis',
        'Target-specific optimization',
        'Wordlist selection',
        'Timing optimization',
      ],
    },
    {
      name: 'Graceful Degradation',
      slug: 'graceful-degradation',
      type: AgentType.GRACEFUL_DEGRADATION,
      description: 'Ensures continuous operation when components fail. It provides fallback mechanisms, alternative workflows, and maintains functionality with reduced capabilities.',
      config: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
      },
      capabilities: [
        'Fallback workflow activation',
        'Service health monitoring',
        'Capability degradation management',
        'Alternative tool substitution',
        'Partial functionality maintenance',
      ],
    },
    {
      name: 'Browser Agent',
      slug: 'browser-agent',
      type: AgentType.BROWSER_AGENT,
      description: 'Advanced headless browser automation for JavaScript-heavy applications. It performs DOM analysis, JavaScript execution monitoring, and automated interaction testing.',
      config: {
        browser: 'chromium',
        headless: true,
        timeout: 30000,
        viewport: { width: 1920, height: 1080 },
      },
      capabilities: [
        'Headless Chrome automation',
        'Screenshot capture',
        'DOM analysis',
        'Network traffic monitoring',
        'Security header analysis',
        'Form detection and analysis',
        'JavaScript execution',
        'Multi-page crawling',
      ],
    },
  ];

  for (const agent of agents) {
    await prisma.aIAgent.upsert({
      where: { slug: agent.slug },
      update: {
        name: agent.name,
        description: agent.description,
        config: agent.config,
        capabilities: agent.capabilities,
      },
      create: {
        name: agent.name,
        slug: agent.slug,
        type: agent.type,
        description: agent.description,
        config: agent.config,
        capabilities: agent.capabilities,
      },
    });
  }
  console.log(`✅ Created ${agents.length} AI agents`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
