/**
 * Mentions United Provider plugin class for retreiving interactions from Vernissage
 * 
 * @author Kristof Zerbe
 * @version 1.0.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub} 
 * 
 * API Documentation: 
 * 
 * Options:
 *  - {String} syndicationUrl     = Full URL of the Vernissage post
 *  - {String} [syndicationTitle] = Title of the Vernissage post, if multiple syndications of original post
 * 
 * Supported origins:
 *  - vernissage
 * 
 * Supported type-verbs:
 *  - like
 *  - repost
 *  - comment
 *  - reply
 * 
 * Remarks:
 *  - 
 */
class MentionsUnitedProvider_Vernissage extends MentionsUnited.Provider {
  key = ""; // will be set via syndicationUrl in constructor (must be unique across all provider plugins for registration)
  
  options = {
    syndicationUrl: "",
    syndicationTitle: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};

    //check mandatory options
    if (this.options.syndicationUrl.length === 0) { throw "'syndicationUrl' is missing"; }

    //get needed information from syndicationUrl
    let vernissageUrl = new URL(this.options.syndicationUrl);
    this.key = vernissageUrl.hostname;
    this.sourceId = vernissageUrl.pathname.split("/").pop();

    //set API endpoint
    this.options.apiBaseUrl = vernissageUrl.origin;
  }

  /**
   * Retrieve data from Vernissage
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving interactions for '${this.options.syndicationUrl}'`;
    args.fStart(msg);

    // 1 - Reposts
    let interactionsReblogged = [];
    try {
      const apiResponseReblogged = await fetch(this.rebloggedApiUrl());
      const apiDataReblogged = await apiResponseReblogged.json();
      interactionsReblogged = this.#processJsonData(apiDataReblogged.data ?? [], "repost");        
    } 
    catch (e) { console.error(e); }
    finally { args.fCount(); }

    // 2 - Likes
    let interactionsFavorited = [];
    try {
      const apiResponseFavorited = await fetch(this.favoritedApiUrl());
      const apiDataFavorited = await apiResponseFavorited.json();
      interactionsFavorited = this.#processJsonData(apiDataFavorited.data ?? [], "like");        
    } 
    catch (e) { console.error(e); }
    finally { args.fCount(); }
    
    // 3 - Comments and Replies
    let interactionsContext = [];
    try {
      await this.#traverseContextTree(this.sourceId, interactionsContext, "comment", args.fCount);
    } 
    catch (e) { console.error(e); }

    args.fEnd(msg);
    return [...interactionsReblogged, ...interactionsFavorited, ... interactionsContext];
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  
  contextApiUrl(id) { return `${this.options.apiBaseUrl}/api/v1/statuses/${id}/context` };
  favoritedApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/favourited`; }
  rebloggedApiUrl() { return `${this.options.apiBaseUrl}/api/v1/statuses/${this.sourceId}/reblogged`; }

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
    r.received = entry.createdAt;

    r.source.provider = this.key;
    r.source.origin = "vernissage";
    r.source.sender = this.key;
    r.source.url = this.options.syndicationUrl;
    r.source.id = entry.id;
    r.source.title = "";

    r.author.name = (["comment","reply"].includes(type)) ? entry.user.name : entry.name;
    r.author.avatar = (["comment","reply"].includes(type)) ? entry.user.avatarUrl : entry.avatarUrl;
    r.author.profile = (["comment","reply"].includes(type)) ? entry.user.activityPubProfile : entry.activityPubProfile;

    r.content.html = entry.noteHtml;
    
    return r;
  }

}
/**
 * Changelog
 * 
 * 1.0.0  - Initial
 */