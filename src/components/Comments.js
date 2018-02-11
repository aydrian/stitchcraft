import React from 'react'
import { StitchClientFactory } from 'mongodb-stitch'

// Import typefaces
import 'typeface-montserrat'
import 'typeface-merriweather'

let stitchClientPromise = StitchClientFactory.create('stitchcraft-ogeho')

class Comments extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      comments: [],
      comment: '',
      author: ''
    }
    this.loadComments = this.loadComments.bind(this)
    this.handleInputChange = this.handleInputChange.bind(this)
    this.handleAddComment = this.handleAddComment.bind(this)
  }

  handleInputChange (event) {
    const target = event.target
    const value = target.type === 'checkbox' ? target.checked : target.value
    const name = target.name

    this.setState({[name]: value})
  }

  loadComments () {
    stitchClientPromise.then(stitchClient => stitchClient.login()
      .then(authedId => {
        console.log(`logged in as:  + ${authedId}`)
        let db = stitchClient.service('mongodb', 'mongodb-atlas').db('blog')
        db.collection('comments').find({post_id: this.props.post.frontmatter.path}).execute()
        .then(comments => {
          this.setState({ comments })
        })
      })
      .catch(e => console.log('error: ', e))
    )
  }

  handleAddComment (event) {
    event.preventDefault()
    stitchClientPromise.then(stitchClient => stitchClient.login()
      .then(authedId => {
        stitchClient.executeFunction('AddComment', {
          post: this.props.post,
          owner_id: authedId,
          comment: this.state.comment,
          author: this.state.author,
          timestamp: new Date()
        })
        .then(result => {
          console.log(result)
        })
        .then(this.loadComments)
        .then(() => {
          this.setState({ comment: '', author: '' })
        })
        .catch(err => {
          console.log(err)
        })
      })
    )
  }

  componentWillMount () {
    this.loadComments()
  }

  render () {
    return (
      <div className='comments'>
        <h3>Comments</h3>
        <hr />
        {this.state.comments.length === 0 && (
          <div>No comments yet. Be the first to add one!</div>
        )}
        {this.state.comments.map(comment => {
          return (<div key={comment._id.toString()} style={{
            padding: `5px`,
            marginBottom: `10px`
          }}>
            <div style={{
              marginLeft: `10px`,
              fontSize: `14px`
            }}>{comment.author} said on {comment.timestamp ? comment.timestamp.toString() : ''}</div>
            <div style={{
              borderRadius: `10px 10px 10px 10px`,
              MozBorderRadius: `10px 10px 10px 10px`,
              WebkitBorderRadius: `10px 10px 10px 10px`,
              border: `5px double #000000`,
              padding: `5px`
            }}>{comment.comment}</div>
          </div>)
        })}
        <hr />
        <form>
          <legend>Leave a comment...</legend>
          <label>
            Your Name:
            <input
              name='author'
              type='text'
              value={this.state.author}
              onChange={this.handleInputChange} />
          </label><br />
          <label>
            Add comment:
            <input
              name='comment'
              type='text'
              value={this.state.comment}
              onChange={this.handleInputChange} />
          </label><br />
          <input type='submit' onClick={this.handleAddComment} />
        </form>
      </div>
    )
  }
}

export default Comments
