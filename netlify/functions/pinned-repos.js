const query = `
query($login:String!){
  user(login:$login){
    pinnedItems(first:4,types:REPOSITORY){
      nodes{
        ...on Repository{
          name
          description
          url
          stargazerCount
          forkCount
          primaryLanguage{name color}
        }
      }
    }
  }
}`;

exports.handler = async () => {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `bearer ${process.env.GITHUB_TOKEN}` // 只在服务端
    },
    body: JSON.stringify({ query, variables: { login: 'JanePHPDev' } })
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const { data } = await res.json();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data.user.pinnedItems.nodes)
  };
};
