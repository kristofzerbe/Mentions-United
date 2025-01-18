/**
 * Mentions United Provider plugin class for retreiving interactions from Mastodon
 * 
 * @author Kristof Zerbe
 * @version 1.1.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub} 
 * 
 * API Documentation: https://docs.joinmastodon.org/client/intro/
 * 
 * Options:
 *  - {String} syndicationUrl     = Full URL of the Mastodon post
 *  - {String} [syndicationTitle] = Title of the Mastodon post, if multiple syndications of original post
 *  - {String} [apiBaseUrl]       = Base URL of API proxy, if existing
 *  - {String} [apiTokenReadOnly] = Token to access Mastodon's API in Read-Only mode, if no proxy
 * 
 * Supported origins:
 *  - mastodon
 * 
 * Supported type-verbs:
 *  - like
 *  - repost
 *  - reply
 * 
 * Remarks:
 *  - For getting public LIKES and BOOSTS (Reposts) there's no need for an API token. 
 *    As of now (January 2025, Mastodon API v4.0.0, https://docs.joinmastodon.org/methods/statuses/#context), 
 *    the retrieval of a maximum of 60 public REPLIES is also possible without a token. 
 *    Therefore, the implementation here is based on the use of a token, but with 
 *    the fallback if it is not specified via 'apiTokenReadOnly' or 'apiBaseUrl'.
 * 
 *    'apiBaseUrl' defines a API PROXY which forwards the requests to the 
 *    Mastodon API according to the same URL scheme. In this case the URL of your  
 *    proxy has to be set to 'apiBaseUrl' and you can leave 'apiTokenReadOnly' blank. 
 
 *    IMPORTANT: The API Token approach means, that your token is visible in your 
 *    JavaScript code and is therefore PUBLICLY AVAILABLE and could be used by ANYONE!
 *
 *    However, if you want to use an API token, you can generate it at: 
 *    https://__INSTANCE__/settings/applications
 */
class MentionsUnitedProvider_Mastodon extends MentionsUnited.Provider {
  key = ""; // will be set via syndicationUrl in constructor (must be unique across all provider plugins for registration)
  
  options = {
    syndicationUrl: "",
    syndicationTitle: "",
    apiBaseUrl: "",
    apiTokenReadOnly: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper(); // if needed

    //check mandatory options
    if (this.options.syndicationUrl.length === 0) { throw "'syndicationUrl' is missing"; }

    //get needed information from syndicationUrl
    let mastodonUrl = new URL(this.options.syndicationUrl);
    this.key = mastodonUrl.hostname;
    this.sourceId = mastodonUrl.pathname.split("/").pop();

    //set API auth option and endpoint
    this.options.apiNoAuth = (this.options.apiBaseUrl.length === 0 && this.options.apiTokenReadOnly.length === 0);
    this.options.apiBaseUrl = this.options.apiBaseUrl || mastodonUrl.origin;
  }

  /**
   * Retrieve data from Mastodon
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving interactions for '${this.options.syndicationUrl}'`;
    args.fStart(msg);

    let fetchOptions;
    if (!this.options.apiNoAuth) {
      fetchOptions = {
        headers: { Authorization: `Bearer ${this.options.apiTokenReadOnly}` }
      };
    }

    // 1 - Reposts (Boosts)
    let interactionsReblogged = [];
    try {
      const apiResponseReblogged = await fetch(this.rebloggedApiUrl(), fetchOptions);
      const apiDataReblogged = await apiResponseReblogged.json();
      interactionsReblogged = this.#processJsonData(apiDataReblogged ?? [], "repost");        
    } 
    catch (e) { console.error(e); }
    finally { args.fCount(); }

    // 2 - Likes
    let interactionsFavorited = [];
    try {
      const apiResponseFavorited = await fetch(this.favoritedApiUrl(), fetchOptions);
      const apiDataFavorited = await apiResponseFavorited.json();
      interactionsFavorited = this.#processJsonData(apiDataFavorited ?? [], "like");        
    } 
    catch (e) { console.error(e); }
    finally { args.fCount(); }
    
    // 3 - Replies
    let interactionsContext = [];
    try {
      const apiResponseContext = await fetch(this.contextApiUrl(), fetchOptions);
      const apiDataContext = await apiResponseContext.json();
      interactionsContext = this.#processJsonData(apiDataContext.descendants ?? [], "reply");        
    } 
    catch (e) { console.error(e); }
    finally { args.fCount(); }

    args.fEnd(msg);
    return [...interactionsReblogged, ...interactionsFavorited, ... interactionsContext];
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  
  contextApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/context` };
  favoritedApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/favourited_by`; }
  rebloggedApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/reblogged_by`; }

  /**
   * Processes retrieved JSON data into flat array of Interaction 
   * @param {Array.<Object>} entries 
   * @param {String} type
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  #processJsonData(entries, type) {
    return entries.map((item) => {
      return this.#convertToInteraction(item, type);
    });
  }
  
  /**
   * Converts specific data object into Interaction
   * @param {Object} entry
   * @param {String} type 
   * @returns {MentionsUnited.Interaction}
   */
  #convertToInteraction(entry, type) {
    let r = new MentionsUnited.Interaction();

    r.syndication.url = this.options.syndicationUrl;
    r.syndication.title = this.options.syndicationTitle;

    r.type = type;
    r.received = entry.created_at;

    r.source.provider = this.key;
    r.source.origin = "mastodon";
    r.source.sender = this.key;
    r.source.url = entry.url;
    r.source.id = entry.id;
    r.source.title = "";

    r.author.name = (type === "reply") ? entry.account.display_name : entry.display_name;
    r.author.avatar = (type === "reply") ? entry.account.avatar : entry.avatar;
    r.author.profile = (type === "reply") ? entry.account.url : entry.url;

    r.content.text = entry.content;
    
    return r;
  }

}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 * 1.1.0 - Added args.fCount() to count requests
 */