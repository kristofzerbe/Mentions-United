/**
 * Sample for a Mentions United Provider plugin class for retreiving comments from GitHub Issues
 * 
 * @author Kristof Zerbe
 * @version 1.0.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub} 
 * 
 * API Documentation: https://docs.github.com/en/graphql
 * 
 * Options:
 *  - {String} syndicationUrl     = Full URL of the GitHub issue
 *  - {String} [apiBaseUrl]       = Base URL of API proxy, if existing
 *  - {String} [apiTokenReadOnly] = Token to access GitHub's API in Read-Only mode, if no proxy
 * 
 * Supported origins:
 *  - github
 * 
 * Supported type-verbs:
 *  - comment
 * 
 * Remarks:
 *  - This implementation is based either on a READ-ONLY token from github.com, 
 *    which you can enter in "apiTokenReadOnly", or you can use an API PROXY that 
 *    forwards requests to the GitHub API. In this case, the URL of your proxy must 
 *    be set to "apiBaseUrl" and you can leave "apiTokenReadOnly" blank.
 * 
 *    IMPORTANT: The API Token approach means, that your token is visible in your 
 *    JavaScript code and is therefore PUBLICLY AVAILABLE and could be used by ANYONE!
 *
 *    However, both variants require the token, that you can generate at: 
 *    https://github.com/settings/tokens. You can use a fine-grained personal access token,
 *    which includes read access to public repositories, or a personal access token (classic) 
 *    with the "public_repo" scope only.
 */
class MentionsUnitedProvider_GitHub extends MentionsUnited.Provider {
  key = "GitHub"; // must be unique across all provider plugins for registration
  
  options = {
    syndicationUrl: "",
    apiBaseUrl: "https://api.github.com/graphql",
    apiTokenReadOnly: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper(); // if needed

    //check mandatory options
    if (this.options.syndicationUrl.length === 0) { throw "'syndicationUrl' is missing"; }
    if (this.options.apiBaseUrl.length === 0 && this.options.apiTokenReadOnly.length === 0) { 
      throw "'apiTokenReadOnly' is missing, as no 'apiBaseUrl' is defined"; 
    }

    //get needed information from syndicationUrl
    let githubUrl = new URL(this.options.syndicationUrl);
    let githubPath = githubUrl.pathname.split("/");

    if (githubUrl.hostname !== "github.com" || githubPath[3] !== "issues") { throw "'syndicationUrl' is not a proper GitHub issue URL"; }

    this.owner = githubPath[1];
    this.repo = githubPath[2];
    this.issueNo =  githubPath[4];
  }

  /**
   * Retrieve data from GitHub
   * @returns {Array.<MentionsUnited.Interaction>}
   * 
   * Remarks:
   *  - be sure to set 'provider' to 'this.key' in every new instance of MentionsUnited.Interaction
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving interactions for '${this.options.syndicationUrl}'`;
    args.fStart(msg);

    let fetchOptions = {
      method: 'POST',
      headers: {
        'X-REQUEST-TYPE': 'GraphQL',
        'Accept': 'application/vnd.github+json'
      },
      body: JSON.stringify(this.issueCommentQuery())
    };
    
    if (this.options.apiTokenReadOnly.length !== 0) {
      fetchOptions.headers.Authorization = `Bearer ${this.options.apiTokenReadOnly}`;
    }
    
    const apiResponse = await fetch(this.graphApiUrl(), fetchOptions);
    const apiData = await apiResponse.json();
    this.issue = apiData.data.repository.issue;
    let interactions = this.#processJsonData(this.issue.comments.nodes);

    args.fCount();
    
    args.fEnd(msg);
    return interactions;
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  
  graphApiUrl() { return `${this.options.apiBaseUrl}/graphql` };
  issueCommentQuery() { return { 
    query: `{
      repository(owner: "${this.owner}", name: "${this.repo}") {
        issue(number: ${this.issueNo}) {
          url
          title
          comments(first: 100) {
            nodes {
              id
              author {
                __typename
                ... on User {
                  login      
                  name
                  avatarUrl
                  websiteUrl
                }
              }
              bodyText
              bodyHTML
              url
              createdAt
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }`}; 
  }

  /**
   * Processes retrieved JSON data into flat array of Interaction 
   * @param {Array.<Object>} commentNodes
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  #processJsonData(commentNodes) {
    return commentNodes.map((item) => {
      return this.#convertToInteraction(item);
    });
  }
  
  /**
   * Converts specific data object into Interaction
   * @param {Object} entry 
   * @returns {MentionsUnited.Interaction}
   */
  #convertToInteraction(entry) {
    let r = new MentionsUnited.Interaction();

    r.syndication.url = this.options.syndicationUrl;
    r.syndication.title = ""; //this.issue.title;

    r.type = "comment";
    r.received = entry.createdAt;

    r.source.provider = this.key;
    r.source.origin = "github";
    r.source.sender = this.key;
    r.source.url = entry.url;
    r.source.id = entry.id;
    r.source.title = "";

    r.author.name = entry.author.name ?? entry.author.login;
    r.author.avatar = entry.author.avatarUrl;
    r.author.profile = entry.author.websiteUrl;

    r.content.text = entry.bodyText;
    r.content.html = entry.bodyHTML;
    
    return r;
  }

}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 */