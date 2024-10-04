/**
 * Mentions United Provider plugin class for retreiving interactions from Pixelfed
 * 
 * @author Kristof Zerbe
 * @version 1.0.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * API Documentation: There is no proper API documentation, but the source code is freely available at: 
 *                    https://github.com/pixelfed/pixelfed/blob/dev/app/Http/Controllers/Api/ApiV1Controller.php
 * 
 * Options:
 *  - {String} sourceUrl          = Full URL of the mentioning page on Pixelfed
 *  - {String} [apiBaseUrl]       = Base URL of API proxy, if existing
 *  - {String} [apiTokenReadOnly] = Token to access Pixelfed's API in Read-Only mode, if no proxy
 * 
 * Supported origins:
 *  - pixelfed
 * 
 * Supported type-verbs:
 *  - repost
 *  - like
 *  - reply
 * 
 * Remarks:
 *  - This implementation relies either on a READ-ONLY token of your Pixelfed instance, 
 *    then you have to set the option 'apiBaseUrl' in the calling code to the URL of 
 *    your instance, or you use an API PROXY which forwards the requests to the 
 *    Pixelfed API according to the same URL scheme. In this case the URL of your  
 *    proxy has to be set to 'apiBaseUrl' and you can leave 'apiTokenReadOnly' blank.
 * 
 *    IMPORTANT: The API Token approach means, that your token is visible in your 
 *    JavaScript code and is therefore PUBLICLY AVAILABLE and could be used by ANYONE! 
 *    You can search for ‘tokenCan(’read‘)’ in the Pixelfed source code to see what 
 *    information you are making freely available with it.
 
 *    However, both variants require the token, that you can generate your token at: 
 *    https://__INSTANCE__/settings/applications.
 * 
*/
class MentionsUnitedProvider_Pixelfed  extends MentionsUnited.Provider {
  key = ""; // will be set via sourceUrl in constructor (must be unique across all provider plugins for registration)
  
  options = {
    sourceUrl: "",
    apiBaseUrl: "",
    apiTokenReadOnly: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};

    //check mandatory options
    if (this.options.sourceUrl.length === 0) { throw "'sourceUrl' is missing"; }
    if (this.options.apiBaseUrl.length === 0 && this.options.apiTokenReadOnly.length === 0) { 
      throw "'apiTokenReadOnly' is missing, as no 'apiBaseUrl' is defined"; 
    }

    //get needed information from sourceUrl
    let pixelfedUrl = new URL(this.options.sourceUrl);
    this.key = pixelfedUrl.hostname;
    this.sourceId = pixelfedUrl.pathname.split("/").pop();
    this.options.apiBaseUrl = this.options.apiBaseUrl ?? pixelfedUrl.origin;
  }

  /**
   * Retrieve data from Pixelfed
   * @returns {Array}
   */
  async retrieve() {
    const msg = `${this.constructor.name}: Retreiving interactions for '${this.options.sourceUrl}'`;
    console.time(msg);
    
    // 1 - Reposts
    let interactionsReblogged = [];
    try {
      const apiResponseReblogged = await fetch(this.rebloggedApiUrl(), {
        headers: { Authorization: `Bearer ${this.options.apiTokenReadOnly}` }
      });
      const apiDataReblogged = await apiResponseReblogged.json();
      interactionsReblogged = this.#processJsonData(apiDataReblogged ?? [], "repost");        
    } catch (e) { console.error(e); }

    // 2 - Likes
    let interactionsFavorited = [];
    try {
      const apiResponseFavorited = await fetch(this.favoritedApiUrl(), {
        headers: { Authorization: `Bearer ${this.options.apiTokenReadOnly}` }
      });
      const apiDataFavorited = await apiResponseFavorited.json();
      interactionsFavorited = this.#processJsonData(apiDataFavorited ?? [], "like");        
    } catch (e) { console.error(e); }

    // 3 - Replies
    let interactionsContext = [];
    try {
      const apiResponseContext = await fetch(this.contextApiUrl(), {
        headers: { Authorization: `Bearer ${this.options.apiTokenReadOnly}` }
      });
      const apiDataContext = await apiResponseContext.json();
      interactionsContext = this.#processJsonData(apiDataContext.descendants ?? [], "reply");        
    } catch (e) { console.error(e); }

    console.timeEnd(msg);
    return [...interactionsReblogged, ...interactionsFavorited, ... interactionsContext];
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  
  statusApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}` };
  contextApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/context` };
  favoritedApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/favourited_by`; }
  rebloggedApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/reblogged_by`; }
  
  /**
   * Processes retrieved JSON data into flat array of Interactions 
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
   * @returns {MentionsUnited.Interaction}
   */
  #convertToInteraction(entry, type) {
    let r = new MentionsUnited.Interaction();

    r.type = type;
    r.received = (type === "reply") ? entry.created_at : undefined;

    r.source.provider = this.key;
    r.source.origin = "pixelfed";
    r.source.sender = this.key;
    r.source.url = this.options.sourceUrl;
    r.source.id = entry.id;

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
 * 1.0.0  - Initial
 */