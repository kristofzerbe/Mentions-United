/**
 * Sample for a Mentions United Provider plugin class for retreiving interactions from Bubbles
 * 
 * On the blog aggregator Bubbles you can vote for a post or you can interact with it via a underlying
 * GoToSocial instance. This plugin retrieves both types of interactions.
 * 
 * @author Kristof Zerbe
 * @version 1.0.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub} 
 * 
 * API Documentation: https://bubbles.town/api
 * 
 * Options:
 *  - {String} syndicationUrl = Full URL of the syndicated post on Bubbles
 * 
 * Supported origins:
 *  - bubbles
 * 
 * Supported type-verbs:
 *  - like
 *  - repost
 *  - reply
 * 
 * Remarks:
 *  - bubbles.town has votes (LIKES) for a post and social.bubbles.town all other interactions
 *    which are accessible via an API bridge provided by bubbles.town
 */
class MentionsUnitedProvider_Bubbles extends MentionsUnited.Provider {
  key = "Bubbles"; // must be unique across all provider plugins for registration

  options = {
    syndicationUrl: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper(); // if needed

    //check mandatory options
    if (this.options.syndicationUrl.length === 0) { throw "'syndicationUrl' is missing"; }

    //get needed information from syndicationUrl
    let bubblesUrl = new URL(this.options.syndicationUrl);
    this.entryId = bubblesUrl.pathname.split("/").pop();
  }

  /**
   * Retrieve data from Bubbles in two steps
   * @returns {Array.<MentionsUnited.Interaction>}
   * 
   * Remarks:
   *  - Step 1: Get interactions (votes) and "fediverse_url" fom bubbles.town
   *  - Step 2: Get interactions from GoToSocial instance via bubbles.town API bridge
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving interactions for '${this.options.syndicationUrl}'`;
    args.fStart(msg);
    
    // Step 1: Bubbles entry
    const apiResponseBubbles = await fetch(this.bubblesApiUrl());
    const apiDataBubbles = await apiResponseBubbles.json();

    this.votes = apiDataBubbles.votes ?? 0;
    this.fediId = apiDataBubbles.fediverse_url.split("/").pop();

    const entryDataBubbles = Array(this.votes).fill(0).map(e => ({  
      url: this.options.syndicationUrl,
      id: this.entryId,
      display_name: "Anonymous",
      avatar: `https://api.dicebear.com/9.x/glass/svg?seed=${this.#getseed(5)}&&backgroundColor=3a8a7f&size=128&scale=75`
    }));
    let interactionsVotes = this.#processJsonData(entryDataBubbles, "vote");

    // Step 2: Bubbles GoToSocial interactions for entry

    // 2.1 - Reposts (Boosts)
    let interactionsReblogged = [];
    try {
      const apiResponseReblogged = await fetch(this.rebloggedApiUrl());
      const apiDataReblogged = await apiResponseReblogged.json();
      interactionsReblogged = this.#processJsonData(apiDataReblogged ?? [], "repost");        
    } 
    catch (e) { console.error(e); }
    finally { args.fCount(); }

    // 2.2 - Likes
    let interactionsFavorited = [];
    try {
      const apiResponseFavorited = await fetch(this.favoritedApiUrl());
      const apiDataFavorited = await apiResponseFavorited.json();
      interactionsFavorited = this.#processJsonData(apiDataFavorited ?? [], "like");        
    } 
    catch (e) { console.error(e); }
    finally { args.fCount(); }
    
    // 2.3 - Replies
    let interactionsContext = [];
    try {
      const apiResponseContext = await fetch(this.contextApiUrl());
      const apiDataContext = await apiResponseContext.json();
      interactionsContext = this.#processJsonData(apiDataContext.descendants ?? [], "reply");        
    } 
    catch (e) { console.error(e); }
    finally { args.fCount(); }

    args.fCount();
    
    args.fEnd(msg);
    return [...interactionsVotes, ...interactionsReblogged, ...interactionsFavorited, ... interactionsContext];
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  
  bubblesApiUrl() { return `https://bubbles.town/api/entry/${this.entryId}`; }
  contextApiUrl() { return `https://bubbles.town/api/fediverse/statuses/${this.fediId}/context` };
  favoritedApiUrl() { return `https://bubbles.town/api/fediverse/statuses/${this.fediId}/favourited_by`; }
  rebloggedApiUrl() { return `https://bubbles.town/api/fediverse/statuses/${this.fediId}/reblogged_by`; }

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

    r.type = (type === "vote") ? "like" : type;
    r.received = (type === "vote") ? null : entry.created_at;

    r.source.provider = this.key;
    r.source.origin = "bubbles";
    r.source.sender = this.key;
    r.source.url = entry.url;
    r.source.id = entry.id;
    r.source.title = "";

    r.author.name = (type === "reply") ? entry.account.display_name : entry.display_name;
    r.author.avatar = (type === "reply") ? entry.account.avatar : entry.avatar;
    r.author.profile = (type === "reply") ? entry.account.url : entry.url;

    r.content.html = (type === "reply") ? entry.content : null;

    return r;
  }

  /**
   * Get random character string for seeding
   * @param {number} length 
   * @returns 
   */
  #getseed(length) {
    var result = "";
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 */