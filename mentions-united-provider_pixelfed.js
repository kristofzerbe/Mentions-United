/**
 * Mentions United Provider plugin class for retreiving interactions from Pixelfed
 * 
 * @author Kristof Zerbe
 * @version 2.2.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * API Documentation: There is no proper API documentation, but the source code is freely available at: 
 *                    https://github.com/pixelfed/pixelfed/blob/dev/app/Http/Controllers/Api/ApiV1Controller.php
 * 
 * Options:
 *  - {String} syndicationUrl     = Full URL of the Pixelfed post
 *  - {String} [syndicationTitle] = Title of the Pixelfed post, if multiple syndications of original post
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
 *    You can search for 'tokenCan('read')' in the Pixelfed source code to see what 
 *    information you are making freely available with it.
 *
 *    However, both variants require the token, that you can generate at: 
 *    https://__INSTANCE__/settings/applications
*/
class MentionsUnitedProvider_Pixelfed extends MentionsUnited.Provider {
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

    //check mandatory options
    if (this.options.syndicationUrl.length === 0) { throw "'syndicationUrl' is missing"; }
    if (this.options.apiBaseUrl.length === 0 && this.options.apiTokenReadOnly.length === 0) { 
      throw "'apiTokenReadOnly' is missing, as no 'apiBaseUrl' is defined"; 
    }

    //get needed information from syndicationUrl
    let pixelfedUrl = new URL(this.options.syndicationUrl);
    this.key = pixelfedUrl.hostname;
    this.sourceId = pixelfedUrl.pathname.split("/").pop();

    //set API endpoint
    this.options.apiBaseUrl = this.options.apiBaseUrl || pixelfedUrl.origin;
  }

  /**
   * Retrieve data from Pixelfed
   * @returns {Array}
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving interactions for '${this.options.syndicationUrl}'`;
    args.fStart(msg);
   
    let fetchOptions;
    if (this.options.apiTokenReadOnly.length !== 0) {
      fetchOptions = {
        headers: { Authorization: `Bearer ${this.options.apiTokenReadOnly}` }
      };
    }
    
    // 1 - Reposts
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
      await this.#traverseContextTree(this.sourceId, interactionsContext, "reply", args.fCount);
    } 
    catch (e) { console.error(e); }

    args.fEnd(msg);
    return [...interactionsReblogged, ...interactionsFavorited, ... interactionsContext];
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  
  contextApiUrl(id) { return `${this.options.apiBaseUrl}/api/v1/statuses/${id}/context` };
  favoritedApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/favourited_by`; }
  rebloggedApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/reblogged_by`; }
  
  /**
   * Traverse context tree recursively over descendants to get comments and their replies
   * @param {Number} id 
   * @param {Array.<MentionsUnited.Interaction>} interactionsContext 
   * @param {String} type 
   * @param {Func} fCount 
   */
  async #traverseContextTree(id, interactionsContext, type, fCount) {
    let apiResponseContext = await fetch(this.contextApiUrl(id));
    let apiDataContext = await apiResponseContext.json();
    fCount();

    if (apiDataContext.descendants.length > 0) {
      let requests = [];
      apiDataContext.descendants.forEach((descendant) => {
        if (!interactionsContext.some((i) => i.source.id === descendant.id)) { 
          interactionsContext.push(this.#convertToInteraction(descendant, type));
        }
        requests.push(this.#traverseContextTree(descendant.id, interactionsContext, "reply", fCount));
      });
      return Promise.all(requests);
    }
  }

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
   * @param {String} type
   * @returns {MentionsUnited.Interaction}
   */
  #convertToInteraction(entry, type) {
    let r = new MentionsUnited.Interaction();

    r.syndication.url = this.options.syndicationUrl;
    r.syndication.title = this.options.syndicationTitle;

    r.type = type;
    r.received = (type === "reply") ? entry.created_at : undefined;

    r.source.provider = this.key;
    r.source.origin = "pixelfed";
    r.source.sender = this.key;
    r.source.url = (type === "reply") ? entry.url : this.options.syndicationUrl;
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
 * 1.0.1 - Introduction of 'sourceTitle', to be able to distinguish several Pixelfed sources textually
 * 2.0.0 - Changed option names due to risk of confusion
 *       - Introducting interaction.syndication
 * 2.1.0 - Introducing retrieve arguments
 *       - Outsourced time measurement
 * 2.1.1 - Clean up retrieving by introducing fetchOptions
 *       - Minor text changes
 * 2.2.0 - Added traversing of context tree for replies
 *       - Added args.fCount() to count requests
 */