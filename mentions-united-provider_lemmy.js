/**
 * Sample for a Mentions United Provider plugin class for retreiving interactions from Lemmy
 * 
 * @author Kristof Zerbe
 * @version 2.1.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub} 
 * It would be wonderful of you open up a PR here to let me add your plugin to the project
 * 
 * API Documentation: https://github.com/MV-GH/lemmy_openapi_spec
 *                    https://lemmy.readme.io/reference
 * 
 * Options:
 *  - {String} syndicationUrl        = Full URL of the Lemmy post
 *  - {String} syndicationCommunity  = Lemmy community name
 * 
 * Supported origins:
 *  - lemmy
 * 
 * Supported type-verbs:
 *  - comment
 * 
 * Remarks:
 *  - 
 */
class MentionsUnitedProvider_Lemmy extends MentionsUnited.Provider {
  key = ""; // will be set via syndicationUrl in constructor (must be unique across all provider plugins for registration)
  
  options = {
    syndicationUrl: "",
    syndicationCommunity: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();

    //check mandatory options
    if (this.options.syndicationUrl.length === 0) { throw "'syndicationUrl' is missing"; }

    //get needed information from syndicationUrl: last token is post id
    let lemmyUrl = new URL(this.options.syndicationUrl);
    this.key = lemmyUrl.hostname;
    this.sourceId = lemmyUrl.pathname.split("/").pop();
    this.apiBaseUrl = lemmyUrl.origin;
  }

  /**
   * Retrieve data from Lemmy
   * @returns {Array.<MentionsUnited.Interaction>}
   * 
   * Remarks:
   *  - be sure to set 'provider' to 'this.key' in every new instance of MentionsUnited.Interaction
   */
  async retrieve(args) {
    const msg = `${this.constructor.name}: Retreiving interactions for '${this.options.syndicationUrl}'`;
    args.fStart(msg);
    
    const apiResponse = await fetch(this.lemmyApiUrl());
    const apiData = await apiResponse.json();

    let interactions = this.#processJsonData(apiData.comments);
    
    args.fEnd(msg);
    return interactions;
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  
  lemmyApiUrl() { return `${this.apiBaseUrl}/api/v3/comment/list?post_id=${this.sourceId}&type_=All&sort=Old` };

  /**
   * Processes retrieved JSON data into flat array of Interaction 
   * @param {Array.<Object>} entries 
   * @returns {Array.<MentionsUnited.Interaction>}
   */
  #processJsonData(entries) {
    return entries.map((item) => {
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
    r.syndication.title = this.options.syndicationCommunity;

    r.type = "comment";
    r.received = entry.comment.published;

    r.source.provider = this.key;
    r.source.origin = "lemmy";
    r.source.sender = this.key;
    r.source.url = entry.comment.ap_id;
    r.source.id = entry.comment.id;
    r.source.title = "";

    r.author.name = entry.creator.display_name ?? entry.creator.name;
    r.author.avatar = entry.creator.avatar;
    r.author.profile = entry.creator.actor_id;

    r.content.text = entry.comment.content;
    r.content.html = this.helper.parseMarkdown(entry.comment.content);

    return r;
  }

}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 * 2.0.0 - Changed option names due to risk of confusion
 *       - Introducting interaction.syndication
 * 2.1.0 - Introducing retrieve arguments
 *       - Outsourced time measurement
 */