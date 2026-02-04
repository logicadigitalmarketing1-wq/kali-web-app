const { PrismaClient } = require('@prisma/client');

async function testAnalysis() {
  const prisma = new PrismaClient();
  
  try {
    // Get a run with stdout but no analysis
    const run = await prisma.run.findFirst({
      where: {
        id: 'cmkyvlb6l0001uuh34sh9bo5l', // nmap run with stdout
      },
      include: {
        tool: true,
        artifacts: true,
      },
    });

    if (!run) {
      console.log('Run not found');
      return;
    }

    const stdout = run.artifacts.find(a => a.type === 'stdout');
    console.log('Run ID:', run.id);
    console.log('Tool:', run.tool.name);
    console.log('Target:', run.target);
    console.log('Has stdout:', !!stdout);
    console.log('Stdout length:', stdout?.content.length);
    console.log('Stdout preview:', stdout?.content.substring(0, 200));
    
    // Try to call Claude API
    const Anthropic = require('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.log('ERROR: No API key found in environment');
      return;
    }
    
    console.log('\nAPI Key configured:', apiKey.substring(0, 20) + '...');
    
    const client = new Anthropic({ apiKey });
    
    console.log('Sending request to Claude...');
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'You are a security analyst. Analyze this tool output.',
      messages: [{ role: 'user', content: `Analyze this ${run.tool.name} output:\n\n${stdout.content}` }],
    });
    
    console.log('Response received!');
    console.log('Tokens used:', response.usage.input_tokens + response.usage.output_tokens);
    console.log('Content preview:', response.content[0].text.substring(0, 200));
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAnalysis();
