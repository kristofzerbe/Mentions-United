/**
 * Mentions United Renderer plugin for displaying a summary line
 * 
 * @author Kristof Zerbe
 * @version 1.1.0
 * @see {@link https://github.com/kristofzerbe/MentionsUnited|GitHub}
 * 
 * Options:
 *  - {String} placeholderId   = for example an ID of the element which will be replaced
 *  - {Callback} [afterRender] = JS function to call after render
 */
class MentionsUnitedRenderer_SummaryLine extends MentionsUnited.Renderer {
  key = "summary-line"; // must be unique across all renderer plugins for registration

  options = { 
    placeholderId: ""
  }

  constructor(options) {
    super();
    this.options = {...this.options, ...options};
    this.helper = new MentionsUnited.Helper();

    //check mandatory options
    if (this.options.placeholderId.length === 0) { throw "'placeholderId' is missing"; }
  }

  /**
   * Renders the summary line
   * @param {Object} args 
   */
  render(args) {

    //set and check placeholder where the element will be inserted
    let placeholder = document.getElementById(this.options.placeholderId);
    if (!placeholder) { throw "No placeholder defined to replace with ..."; }
    
    const templates = new this.#Templates(this.helper);

    let data = {
      iaCount: args.interactions.length,
      requestsCount: Object.values(args.providers).reduce((r, {requests}) => r + requests, 0), //Object.keys(args.providers).length,
      uniqueProviderCount: Object.keys(Object.groupBy(Object.values(args.providers), p => p.key)).length,
      duration: ((args.info.retrieval.end - args.info.retrieval.start) / 1000).toFixed(2)
    }

    let html = templates.summary(data);
    let result = this.helper.createElementFromHtml(html);

    //replace placeholder with result element
    placeholder.replaceWith(result);

     //call afterRender callback, if defined
    if (typeof this.options.afterRender === "function") {
      this.options.afterRender();
    }
 }

  //////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Template class to hold methods for composing the HTML
   */
  #Templates = class Templates {

    constructor(helper) {
      this.helper = helper;
    }

    /**
     * Composes an Interaction element ... fo example 'like from John Doe'
     * @param {MentionsUnited.Interaction} ia
     * @returns {String}
     */
    summary(data) {
      return this.helper.fillLiteralTemplate(
        `
        <p class="interactions-summary-line">
          ${data.iaCount} interaction${data.iaCount === 1 ? "" : "s"} collected by 
          <a target="_blank" href="https://github.com/kristofzerbe/MentionsUnited">Mentions United</a> 
          via ${data.uniqueProviderCount} unique provider${data.uniqueProviderCount === 1 ? "" : "s"} and 
          ${data.requestsCount} request${data.requestsCount === 1 ? "" : "s"} in ${data.duration} seconds
        </p>
        `,
        data
      );
    }

  }

}
/**
 * Changelog
 * 
 * 1.0.0 - Initial
 * 1.1.0 - Changed providerCount into true requestCount
 */